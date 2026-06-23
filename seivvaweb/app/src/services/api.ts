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
  return (product.etiquetas || []).map(t => badgeMap[t]).filter(Boolean)
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
