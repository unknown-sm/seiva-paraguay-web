import type {
  EcommerceAdapter,
  InventoryReport,
  PeriodRange,
  Product,
  ProductSummary,
  SalesReport,
} from './adapter.js';
import { AppError } from '../errors.js';

/**
 * Conector de SOLO LECTURA contra la API HTTP de la tienda Seiva
 * (el mismo backend Express que sirve la web: GET /api/productos).
 *
 * - Nunca escribe: solo GET públicos que ya consume el frontend.
 * - Un solo request por operación, con caché TTL corta alineada al
 *   Cache-Control de la tienda (s-maxage=30).
 */

interface StoreProduct {
  id: number;
  nombre: string;
  sku?: string | null;
  precio: number;
  precio_anterior?: number | null;
  stock: number;
  activo: boolean;
  marca?: string | null;
  categoria?: string | null;
  categoria_id?: number | null;
  subcategoria?: string | null;
  slug?: string | null;
  descripcion?: string | null;
  descripcion_larga?: string | null;
  imagen?: string | null;
  galeria?: string[];
  etiquetas?: string[];
  destacado?: boolean | number;
  featured_order?: number;
  meta_titulo?: string | null;
  meta_descripcion?: string | null;
  seo_descripcion?: string | null;
  crosssell?: number[];
  upsell?: number[];
}

const CACHE_TTL_MS = 30_000;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Match con tolerancia a typos de carga (ej: "Colostro" vs "calostro"):
 * substring directo, o distancia de edición <= 1-2 contra cada palabra
 * del nombre/SKU/marca.
 */
function termMatches(term: string, haystack: string): boolean {
  if (haystack.includes(term)) return true;
  const maxDist = term.length >= 6 ? 2 : 1;
  for (const word of haystack.split(/[^a-z0-9]+/)) {
    if (Math.abs(word.length - term.length) > maxDist) continue;
    if (levenshtein(word, term) <= maxDist) return true;
  }
  return false;
}

function toSummary(p: StoreProduct): ProductSummary {
  return {
    id: String(p.id),
    name: p.nombre,
    sku: p.sku || '',
    price: p.precio,
    stock: p.stock ?? 0,
    status: p.activo ? 'published' : 'draft',
    category: p.categoria || p.subcategoria || p.marca || undefined,
  };
}

function toFull(p: StoreProduct): Product {
  const summary = toSummary(p);
  const images: Product['images'] = [];
  if (p.imagen) images.push({ url: p.imagen, alt: p.nombre });
  for (const g of p.galeria || []) {
    if (g && g !== p.imagen) images.push({ url: g });
  }
  return {
    ...summary,
    description: p.descripcion_larga || p.descripcion || '',
    shortDescription: p.descripcion || '',
    images,
    seo: {
      title: p.meta_titulo || p.nombre,
      metaDescription: p.meta_descripcion || undefined,
      slug: p.slug || String(p.id),
    },
  };
}

export class StoreApiAdapter implements EcommerceAdapter {
  private readonly baseUrl: string;
  private readonly auth?: { username: string; password: string };
  private token: { value: string; expiresAt: number } | null = null;
  private cache: { products: StoreProduct[]; fetchedAt: number } | null = null;
  private inflight: Promise<StoreProduct[]> | null = null;

  constructor(baseUrl: string, auth?: { username: string; password: string }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.auth = auth;
  }

  /** Login contra /api/auth/login con cache del JWT (dura 24h en la tienda). */
  private async ensureToken(): Promise<string> {
    if (!this.auth) {
      throw new AppError('INTERNAL', 'La tool de escritura requiere credenciales de la tienda', {
        hint: 'Configurá STORE_API_USER y STORE_API_PASSWORD en el backend del agente.',
      });
    }
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;

    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(this.auth),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new AppError('UNAUTHORIZED', `Login de la tienda falló (${res.status})`, {
        hint: 'Verificá STORE_API_USER / STORE_API_PASSWORD.',
      });
    }
    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      throw new AppError('UNAUTHORIZED', 'La tienda no devolvió token');
    }
    // Renovar con margen: expira a las 23h del ciclo de 24h de la tienda.
    this.token = { value: data.token, expiresAt: Date.now() + 23 * 3600_000 };
    return this.token.value;
  }

  private async fetchProducts(): Promise<StoreProduct[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.products;
    }
    if (this.inflight) return this.inflight;

    // Con credenciales: catálogo completo (/all, incluye inactivos).
    // Sin credenciales: listado público (solo activos).
    const headers: Record<string, string> = { accept: 'application/json' };
    let path = '/api/productos';
    if (this.auth) {
      try {
        headers.authorization = `Bearer ${await this.ensureToken()}`;
        path = '/api/productos/all';
      } catch {
        // Sin login válido caemos al listado público (solo lectura).
      }
    }

    this.inflight = fetch(`${this.baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new AppError('INTERNAL', `La tienda respondió ${res.status} al listar productos`, {
            hint: 'Reintentá en unos segundos; si persiste, revisá el estado de la tienda.',
          });
        }
        const products = (await res.json()) as StoreProduct[];
        this.cache = { products, fetchedAt: Date.now() };
        return products;
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }

  async searchProducts(
    query: string | undefined,
    filters: { status?: 'published' | 'draft' | 'all'; inStock?: boolean; category?: string },
    limit: number
  ): Promise<ProductSummary[]> {
    const products = await this.fetchProducts();
    const q = query ? normalize(query.trim()) : '';

    const terms = q.split(/\s+/).filter(Boolean);
    const matches = products.filter((p) => {
      if (filters.inStock && (p.stock ?? 0) <= 0) return false;
      if (filters.category && !normalize(p.categoria || p.subcategoria || '').includes(normalize(filters.category))) {
        return false;
      }
      if (!terms.length) return true;
      const haystack = normalize(
        `${p.nombre} ${p.sku || ''} ${p.marca || ''} ${p.slug || ''} ${p.categoria || ''} ${p.subcategoria || ''}`
      );
      return terms.every((t) => termMatches(t, haystack));
    });

    // In-stock primero (criterio del propio listado de la tienda), luego id desc.
    matches.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || b.id - a.id);

    return matches.slice(0, limit).map(toSummary);
  }

  async getProduct(id: string): Promise<Product | null> {
    const products = await this.fetchProducts();
    const found = products.find((p) => String(p.id) === id);
    return found ? toFull(found) : null;
  }

  async getSalesReport(
    _range: PeriodRange,
    _previous: PeriodRange | null,
    _groupBy: 'product' | 'category' | 'day'
  ): Promise<SalesReport> {
    throw new AppError('VALIDATION', 'El reporte de ventas todavía no está conectado a la tienda', {
      hint: 'El conector de ventas requiere credenciales del módulo de ventas de la tienda (pendiente). Decile al usuario que esta función estará disponible próximamente.',
    });
  }

  async getInventoryReport(threshold: number): Promise<InventoryReport> {
    const products = await this.fetchProducts();
    const summaries = products.map(toSummary);
    return {
      threshold,
      lowStock: summaries.filter((p) => p.stock > 0 && p.stock <= threshold),
      outOfStock: summaries.filter((p) => p.stock <= 0),
      topRotation: [],
      generatedAt: new Date().toISOString(),
    };
  }

  async updateProductStock(id: string, stock: number): Promise<ProductSummary> {
    const token = await this.ensureToken();
    // stock-batch actualiza SOLO la columna stock; nunca pisa otros campos.
    const res = await fetch(`${this.baseUrl}/api/productos/stock-batch`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ updates: [{ id: Number(id), stock }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AppError('INTERNAL', `La tienda rechazó el cambio de stock (${res.status})`, {
        hint: body.slice(0, 200) || 'Reintentá; si persiste, revisá permisos del usuario de la tienda.',
      });
    }
    this.cache = null; // forzar re-lectura
    const updated = await this.getProduct(id);
    if (!updated) {
      throw new AppError('INTERNAL', `Stock enviado pero el producto ${id} ya no aparece en el catálogo`);
    }
    return updated;
  }

  /**
   * La tienda no tiene endpoint dirigido de precio: read-modify-write con el
   * PUT completo, reenviando TODOS los campos actuales salvo los que el PUT
   * no debe tocar (variantes, precio_proveedor, delivery_gratis: quedan
   * undefined y el backend de la tienda los omite). Verificación después.
   */
  async updateProductPrice(id: string, price: number): Promise<ProductSummary> {
    const current = await this.getProduct(id);
    if (!current) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${id}'`);
    }
    const full = await this.fetchFullRaw(id);
    const token = await this.ensureToken();

    const body: Record<string, unknown> = {
      nombre: full.nombre,
      precio: price,
      precio_anterior: full.precio_anterior ?? null,
      categoria: full.categoria,
      subcategoria: full.subcategoria ?? '',
      descripcion: full.descripcion ?? '',
      descripcion_larga: full.descripcion_larga ?? '',
      galeria: full.galeria ?? [],
      etiquetas: full.etiquetas ?? [],
      destacado: !!full.destacado,
      imagen: full.imagen ?? '',
      stock: full.stock ?? 0,
      activo: !!full.activo,
      categoria_id: full.categoria_id ?? null,
      sku: full.sku ?? '',
      marca: full.marca ?? '',
      seo_descripcion: full.seo_descripcion ?? '',
      meta_titulo: full.meta_titulo ?? '',
      meta_descripcion: full.meta_descripcion ?? '',
      crosssell: full.crosssell ?? [],
      upsell: full.upsell ?? [],
      slug: full.slug ?? '',
      featured_order: full.featured_order ?? 0,
    };

    const res = await fetch(`${this.baseUrl}/api/productos/${id}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new AppError('INTERNAL', `La tienda rechazó el cambio de precio (${res.status})`, {
        hint: errBody.slice(0, 200) || 'Reintentá; si persiste, revisá permisos del usuario de la tienda.',
      });
    }

    this.cache = null;
    const updated = await this.getProduct(id);
    if (!updated || updated.price !== price) {
      throw new AppError('INTERNAL', `El cambio de precio no se reflejó en el producto ${id}`);
    }
    return updated;
  }

  async setProductActive(id: string, active: boolean): Promise<ProductSummary> {
    const current = await this.getProduct(id);
    if (!current) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${id}'`);
    }
    // Toggle de la tienda es un flip: si ya está en el estado pedido, no tocar.
    if (current.status === (active ? 'published' : 'draft')) {
      return current;
    }
    const token = await this.ensureToken();
    const res = await fetch(`${this.baseUrl}/api/productos/${id}/toggle`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new AppError('INTERNAL', `La tienda rechazó el cambio de estado (${res.status})`);
    }
    this.cache = null;
    const updated = await this.getProduct(id);
    if (!updated || updated.status !== (active ? 'published' : 'draft')) {
      throw new AppError('INTERNAL', `El cambio de estado no se reflejó en el producto ${id}`);
    }
    return updated;
  }

  /** Producto crudo completo (para el read-modify-write del precio). */
  private async fetchFullRaw(id: string): Promise<StoreProduct> {
    const all = await this.fetchProducts();
    const found = all.find((p) => String(p.id) === id);
    if (!found) throw new AppError('NOT_FOUND', `No encontré el producto '${id}'`);
    return found;
  }
}
