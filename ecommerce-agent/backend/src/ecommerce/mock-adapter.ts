import type {
  EcommerceAdapter,
  InventoryReport,
  PeriodRange,
  Product,
  ProductSummary,
  SalesReport,
  SalesTotals,
} from './adapter.js';
import { AppError } from '../errors.js';

interface MockOrder {
  date: Date;
  items: Array<{ productId: string; qty: number; unitPrice: number }>;
  total: number;
}

const PRODUCTS: Product[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001', name: 'Magnesio Bisglicinato 60 cápsulas', sku: 'MAG-BIS-60',
    price: 4990, stock: 3, status: 'published', category: 'suplementos',
    description: 'Magnesio bisglicinato de alta biodisponibilidad. Apoya el funcionamiento muscular y nervioso.',
    shortDescription: 'Magnesio de alta absorción, 60 cápsulas.',
    images: [{ url: 'https://cdn.example.com/mag-bis-60-1.jpg', alt: 'Frasco de Magnesio Bisglicinato 60 cápsulas' }],
    seo: { title: 'Magnesio Bisglicinato 60 cápsulas | Alta Absorción', metaDescription: 'Magnesio bisglicinato...', slug: 'magnesio-bisglicinato-60-capsulas' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002', name: 'Magnesio Marino 120 cápsulas', sku: 'MAG-MAR-120',
    price: 6500, stock: 18, status: 'published', category: 'suplementos',
    description: 'Magnesio de origen marino.', shortDescription: 'Magnesio marino, 120 cápsulas.',
    images: [], seo: { slug: 'magnesio-marino-120-capsulas' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003', name: 'Vitamina D3 2000 UI', sku: 'VIT-D3-2000',
    price: 3200, stock: 0, status: 'published', category: 'suplementos',
    description: 'Vitamina D3 para salud ósea e inmune.', shortDescription: 'Vitamina D3, 2000 UI.',
    images: [], seo: { slug: 'vitamina-d3-2000ui' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004', name: 'Omega 3 1000mg', sku: 'OMG-3-1000',
    price: 4100, stock: 42, status: 'published', category: 'suplementos',
    description: 'Aceite de pescado purificado.', shortDescription: 'Omega 3, 1000 mg.',
    images: [], seo: { slug: 'omega-3-1000mg' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005', name: 'Colágeno Hidrolizado 300g', sku: 'COL-HID-300',
    price: 7800, stock: 4, status: 'published', category: 'suplementos',
    description: 'Colágeno hidrolizado con vitamina C.', shortDescription: 'Colágeno hidrolizado, 300 g.',
    images: [], seo: { slug: 'colageno-hidrolizado-300g' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006', name: 'Creatina Monohidrato 500g', sku: 'CRE-MON-500',
    price: 9900, stock: 25, status: 'published', category: 'deportivo',
    description: 'Creatina monohidrato micronizada.', shortDescription: 'Creatina monohidrato, 500 g.',
    images: [], seo: { slug: 'creatina-monohidrato-500g' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007', name: 'Ashwagandha KSM-66 60 cápsulas', sku: 'ASH-KSM-60',
    price: 5600, stock: 12, status: 'draft', category: 'suplementos',
    description: 'Ashwagandha estandarizada KSM-66.', shortDescription: 'Ashwagandha KSM-66, 60 cápsulas.',
    images: [], seo: { slug: 'ashwagandha-ksm-66-60-capsulas' },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000008', name: 'Proteína Whey Vainilla 1kg', sku: 'WHE-VAI-1000',
    price: 15900, stock: 9, status: 'published', category: 'deportivo',
    description: 'Proteína de suero concentrada.', shortDescription: 'Whey protein, vainilla 1 kg.',
    images: [], seo: { slug: 'proteina-whey-vainilla-1kg' },
  },
];

/**
 * Generador pseudoaleatorio determinista (LCG): los pedidos del mock son
 * siempre iguales para que reportes y tests sean reproducibles.
 */
function buildOrders(): MockOrder[] {
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const now = new Date();
  const orders: MockOrder[] = [];
  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const count = 2 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, 9 + Math.floor(rnd() * 12));
      const itemCount = 1 + Math.floor(rnd() * 3);
      const items: MockOrder['items'] = [];
      for (let j = 0; j < itemCount; j++) {
        const product = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)];
        if (items.some((it) => it.productId === product.id)) continue;
        items.push({ productId: product.id, qty: 1 + Math.floor(rnd() * 3), unitPrice: product.price });
      }
      orders.push({ date, items, total: items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0) });
    }
  }
  return orders;
}

function totalsFor(orders: MockOrder[]): SalesTotals {
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const units = orders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.qty, 0), 0);
  return {
    orders: orders.length,
    revenue: Math.round(revenue),
    units,
    avgTicket: orders.length ? Math.round(revenue / orders.length) : 0,
  };
}

function toSummary(p: Product): ProductSummary {
  const { id, name, sku, price, stock, status, category } = p;
  return { id, name, sku, price, stock, status, category };
}

export class MockEcommerceAdapter implements EcommerceAdapter {
  private readonly orders = buildOrders();

  async searchProducts(
    query: string | undefined,
    filters: { status?: 'published' | 'draft' | 'all'; inStock?: boolean; category?: string },
    limit: number
  ): Promise<ProductSummary[]> {
    const q = query?.toLowerCase();
    return PRODUCTS
      .filter((p) => {
        if (q && !(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) return false;
        if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
        if (filters.inStock !== undefined && (p.stock > 0) !== filters.inStock) return false;
        if (filters.category && p.category !== filters.category.toLowerCase()) return false;
        return true;
      })
      .slice(0, limit)
      .map(toSummary);
  }

  async getProduct(id: string): Promise<Product | null> {
    return PRODUCTS.find((p) => p.id === id) ?? null;
  }

  async getSalesReport(
    range: PeriodRange,
    previous: PeriodRange | null,
    groupBy: 'product' | 'category' | 'day'
  ): Promise<SalesReport> {
    const inRange = this.orders.filter((o) => o.date >= range.from && o.date < range.to);

    const report: SalesReport = {
      period: { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
      totals: totalsFor(inRange),
      groupBy,
    };

    if (groupBy === 'product') {
      const byProduct = new Map<string, { productId: string; name: string; units: number; revenue: number }>();
      for (const order of inRange) {
        for (const item of order.items) {
          const product = PRODUCTS.find((p) => p.id === item.productId);
          const entry = byProduct.get(item.productId) ?? { productId: item.productId, name: product?.name ?? item.productId, units: 0, revenue: 0 };
          entry.units += item.qty;
          entry.revenue += item.qty * item.unitPrice;
          byProduct.set(item.productId, entry);
        }
      }
      report.byProduct = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }

    if (groupBy === 'category') {
      const byCategory = new Map<string, { category: string; units: number; revenue: number }>();
      for (const order of inRange) {
        for (const item of order.items) {
          const category = PRODUCTS.find((p) => p.id === item.productId)?.category ?? 'otros';
          const entry = byCategory.get(category) ?? { category, units: 0, revenue: 0 };
          entry.units += item.qty;
          entry.revenue += item.qty * item.unitPrice;
          byCategory.set(category, entry);
        }
      }
      report.byCategory = [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);
    }

    if (groupBy === 'day') {
      const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
      for (const order of inRange) {
        const key = order.date.toISOString().slice(0, 10);
        const entry = byDay.get(key) ?? { date: key, orders: 0, revenue: 0 };
        entry.orders += 1;
        entry.revenue += order.total;
        byDay.set(key, entry);
      }
      report.byDay = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    }

    if (previous) {
      const prevOrders = this.orders.filter((o) => o.date >= previous.from && o.date < previous.to);
      report.comparison = { label: previous.label, totals: totalsFor(prevOrders) };
    }

    return report;
  }

  async getInventoryReport(threshold: number): Promise<InventoryReport> {
    const from30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rotation = new Map<string, number>();
    for (const order of this.orders) {
      if (order.date < from30d) continue;
      for (const item of order.items) {
        rotation.set(item.productId, (rotation.get(item.productId) ?? 0) + item.qty);
      }
    }

    return {
      threshold,
      lowStock: PRODUCTS.filter((p) => p.stock > 0 && p.stock <= threshold).map(toSummary),
      outOfStock: PRODUCTS.filter((p) => p.stock === 0).map(toSummary),
      topRotation: [...rotation.entries()]
        .map(([productId, unitsSold30d]) => ({
          productId,
          name: PRODUCTS.find((p) => p.id === productId)?.name ?? productId,
          unitsSold30d,
        }))
        .sort((a, b) => b.unitsSold30d - a.unitsSold30d)
        .slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  async updateProductStock(id: string, stock: number): Promise<ProductSummary> {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${id}'`);
    }
    product.stock = stock;
    return toSummary(product);
  }
}
