const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://85.239.246.177:3001/api'
  : '/api';

export interface PriceTier {
  min_cantidad: number;
  max_cantidad: number | null;
  descuento: number;
}

export interface Product {
  id: number;
  nombre: string;
  slug?: string;
  precio: number;
  precio_anterior: number | null;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  descripcion_larga?: string;
  imagen: string;
  galeria?: string[];
  etiquetas: string[];
  destacado: boolean;
  activo: boolean;
  stock: number;
  sku?: string;
  marca?: string;
  seo_descripcion?: string;
  crosssell?: number[];
  upsell?: number[];
  categoria_id?: number;
  price_tiers?: PriceTier[];
  featured_order?: number;
  delivery_gratis?: boolean;
}

const IMAGE_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://85.239.246.177:8080'
  : '';

function fixImageUrl(imagen: string): string {
  if (!imagen) return '';
  if (imagen.startsWith('http')) return imagen;
  const base = IMAGE_BASE || '/img/productos';
  return base + '/' + imagen.replace(/^\//, '');
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/productos`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const products: Product[] = await res.json();
  return products.map(p => ({ ...p, imagen: fixImageUrl(p.imagen) }));
}

export async function fetchFeatured(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/productos/destacados`);
  if (!res.ok) throw new Error('Failed to fetch featured products');
  const products: Product[] = await res.json();
  return products.map(p => ({ ...p, imagen: fixImageUrl(p.imagen) }));
}

export function formatPrice(price: number): string {
  return 'Gs.' + price.toLocaleString('es-PY');
}

export function generateWhatsAppLink(product: Product): string {
  const baseUrl = window.location.origin;
  const productUrl = `${baseUrl}/producto/${product.slug || product.id}`;
  const msg = encodeURIComponent(
    `Hola Seiva! Me interesa:\n\n*${product.nombre}*\nPrecio: ${formatPrice(product.precio)}\n\n${productUrl}`
  );
  return `https://wa.me/595992120303?text=${msg}`;
}

export interface PedidoPayload {
  cliente: string;
  whatsapp: string;
  direccion: string;
  productos: { id: number; nombre: string; precio: number; cantidad: number }[];
  total: number;
  metodo_pago: string;
  notas?: string;
}

export async function createPedido(payload: PedidoPayload): Promise<{ id: number; estado: string }> {
  const res = await fetch(`${API_BASE}/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create pedido');
  return res.json();
}

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

export function getProductBadges(product: Product): { label: string; color: string }[] {
  const badgeMap: Record<string, { label: string; color: string }> = {
    nuevo: { label: 'Nuevo', color: '#3B82F6' },
    popular: { label: 'Popular', color: '#F59E0B' },
    oferta: { label: 'Oferta', color: '#E63946' },
    envio_gratis: { label: 'Envío gratis', color: '#10B981' },
    mas_vendido: { label: 'Más vendido', color: '#8B5CF6' },
    '2x1': { label: '2x1', color: '#EC4899' },
    '3x2': { label: '3x2', color: '#F97316' },
  }
  const badges = (product.etiquetas || []).map(t => badgeMap[t]).filter(Boolean)
  if (product.delivery_gratis) {
    badges.push({ label: 'Delivery gratis', color: '#10B981' })
  }
  return badges
}

export function getDiscountedPrice(product: Product, quantity: number): number {
  if (!product.price_tiers?.length) return product.precio
  const tier = product.price_tiers.find(t =>
    quantity >= t.min_cantidad &&
    (t.max_cantidad === null || quantity <= t.max_cantidad)
  )
  return tier ? product.precio - tier.descuento : product.precio
}

export function getActiveTier(product: Product, quantity: number): PriceTier | undefined {
  if (!product.price_tiers?.length) return undefined
  return product.price_tiers.find(t =>
    quantity >= t.min_cantidad &&
    (t.max_cantidad === null || quantity <= t.max_cantidad)
  )
}

export function getNextTier(product: Product, quantity: number): PriceTier | undefined {
  if (!product.price_tiers?.length) return undefined
  return product.price_tiers.find(t =>
    quantity < t.min_cantidad
  )
}

export function getBestTier(product: Product): PriceTier | undefined {
  if (!product.price_tiers?.length) return undefined
  let best = product.price_tiers[0]
  for (const t of product.price_tiers) {
    if (t.descuento > best.descuento) best = t
  }
  return best
}

export function getTierLabel(tier: PriceTier, product: Product): string {
  const price = product.precio - tier.descuento
  const range = tier.max_cantidad ? `${tier.min_cantidad}-${tier.max_cantidad}u` : `${tier.min_cantidad}+u`
  return `${range} ${formatPrice(price)}`
}

export function getTierSummary(product: Product): string | null {
  if (!product.price_tiers?.length) return null
  const best = getBestTier(product)
  if (!best) return null
  const price = product.precio - best.descuento
  return `Desde ${formatPrice(price)}`
}

export interface Promo {
  id: number
  tipo: string
  nombre: string
  producto_id: number | null
  marca_id: number | null
  compra_min_cantidad: number
  compra_min_monto: number
  regala_cantidad: number
  regala_producto_id: number | null
  descuento_valor: number
  descuento_tipo: string
  cupon_codigo: string | null
  cupon_usos_max: number | null
  cupon_usos_actuales: number
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: number
  prioridad: number
}

export async function fetchPromos(): Promise<Promo[]> {
  const res = await fetch(`${API_BASE}/promos`)
  if (!res.ok) throw new Error('Failed to fetch promos')
  return res.json()
}

export async function validateCupon(codigo: string): Promise<{ id: number; descuento_valor: number; descuento_tipo: string; minimo_compra: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/cupones/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo })
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
