const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://85.239.246.177:3001/api'
  : '/api';

export interface Product {
  id: number;
  nombre: string;
  precio: number;
  precio_anterior: number | null;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  imagen: string;
  etiquetas: string[];
  destacado: boolean;
}

const IMAGE_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://85.239.246.177:8080'
  : '';

function fixImageUrl(imagen: string): string {
  if (!imagen) return '';
  if (imagen.startsWith('http')) return imagen;
  return IMAGE_BASE + imagen;
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/productos`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const products: Product[] = await res.json();
  return products.map(p => ({ ...p, imagen: fixImageUrl(p.imagen) }));
}

export function formatPrice(price: number): string {
  return 'Gs.' + price.toLocaleString('es-PY');
}

export function generateWhatsAppLink(product: Product): string {
  const msg = encodeURIComponent(
    `Hola Seiva! Quiero consultar por: *${product.nombre}* — ${formatPrice(product.precio)}`
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
