/**
 * Interfaz entre la Agent API y el ecommerce real.
 *
 * En la integración real (fase de conexión con tu backend Node.js) se implementa
 * esta interfaz sobre los servicios/modelos existentes del ecommerce. El
 * MockEcommerceAdapter permite desarrollar y probar todo el pipeline sin BD.
 */

export interface ProductSummary {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: 'published' | 'draft';
  category?: string;
}

export interface Product extends ProductSummary {
  description: string;
  shortDescription: string;
  images: Array<{ url: string; alt?: string }>;
  seo: { title?: string; metaDescription?: string; slug: string };
}

export interface SalesTotals {
  orders: number;
  revenue: number;
  units: number;
  avgTicket: number;
}

export interface PeriodRange {
  label: string;
  from: Date;
  to: Date;
}

export interface SalesReport {
  period: { label: string; from: string; to: string };
  totals: SalesTotals;
  groupBy: 'product' | 'category' | 'day';
  byProduct?: Array<{ productId: string; name: string; units: number; revenue: number }>;
  byCategory?: Array<{ category: string; units: number; revenue: number }>;
  byDay?: Array<{ date: string; orders: number; revenue: number }>;
  comparison?: { label: string; totals: SalesTotals };
}

export interface InventoryReport {
  threshold: number;
  lowStock: ProductSummary[];
  outOfStock: ProductSummary[];
  topRotation: Array<{ productId: string; name: string; unitsSold30d: number }>;
  generatedAt: string;
}

export interface EcommerceAdapter {
  searchProducts(
    query: string | undefined,
    filters: { status?: 'published' | 'draft' | 'all'; inStock?: boolean; category?: string },
    limit: number
  ): Promise<ProductSummary[]>;

  getProduct(id: string): Promise<Product | null>;

  getSalesReport(range: PeriodRange, previous: PeriodRange | null, groupBy: 'product' | 'category' | 'day'): Promise<SalesReport>;

  getInventoryReport(threshold: number): Promise<InventoryReport>;

  /**
   * Fase 2 (escritura): cambia SOLO el stock de un producto. Debe usar el
   * endpoint de actualización dirigida de la tienda (nunca un PUT completo
   * que pise el resto de los campos). Devuelve el resumen actualizado.
   */
  updateProductStock(id: string, stock: number): Promise<ProductSummary>;

  /**
   * Fase 2 (escritura): cambia SOLO el precio. La tienda no tiene endpoint
   * dirigido para precio: implementar como read-modify-write (leer producto
   * completo, reenviar todo igual con el precio nuevo) y verificar después.
   */
  updateProductPrice(id: string, price: number): Promise<ProductSummary>;

  /**
   * Fase 2 (escritura): publica o despublica un producto (endpoint toggle
   * de la tienda). Devuelve el resumen con el estado resultante.
   */
  setProductActive(id: string, active: boolean): Promise<ProductSummary>;
}
