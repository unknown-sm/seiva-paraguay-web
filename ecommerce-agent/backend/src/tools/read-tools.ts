import { z } from 'zod';
import { AppError } from '../errors.js';
import { parsePeriod, previousPeriod } from '../ecommerce/period.js';
import type { ToolDefinition } from '../agent/tool-registry.js';
import type { ToolRegistry } from '../agent/tool-registry.js';

/**
 * n8n envía los parámetros como strings dentro del jsonBody, por eso los
 * números y booleanos aceptan también su forma string y se normalizan acá.
 * Los opcionales reciben "" cuando el LLM no los completa: se tratan como
 * ausentes para que apliquen los defaults del schema.
 */
const emptyAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

const optionalBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

const searchProductsSchema = z.object({
  query: emptyAsUndefined(z.string().min(1).optional()),
  filters: z
    .object({
      status: emptyAsUndefined(z.enum(['published', 'draft', 'all']).optional()),
      in_stock: optionalBoolean.optional(),
      category: emptyAsUndefined(z.string().min(1).optional()),
    })
    .optional(),
  limit: emptyAsUndefined(z.coerce.number().int().min(1).max(50).default(10)),
});
type SearchProductsParams = z.infer<typeof searchProductsSchema>;

const searchProducts: ToolDefinition<SearchProductsParams> = {
  name: 'search_products',
  description:
    'Busca productos del catálogo por texto (nombre o SKU) y/o filtros (estado, stock, categoría). Devuelve lista con posición, id, nombre, sku, precio, stock y estado. La posición habilita referencias posteriores como "el segundo".',
  permissionClass: 'R',
  paramSchema: searchProductsSchema,
  handler: async (params, ctx) => {
    const results = await ctx.adapter.searchProducts(
      params.query,
      {
        status: params.filters?.status,
        inStock: params.filters?.in_stock,
        category: params.filters?.category,
      },
      params.limit
    );
    return {
      data: { count: results.length, results },
      entityType: 'product_list',
      sessionUpdate: {
        lastProductList: results.map((p, i) => ({ position: i + 1, id: p.id, name: p.name })),
        lastFocusProductId: results[0]?.id ?? null,
      },
    };
  },
};

const getProductSchema = z.object({ product_id: z.string().min(1) });

const getProduct: ToolDefinition<z.infer<typeof getProductSchema>> = {
  name: 'get_product',
  description:
    'Obtiene la ficha completa de un producto por su id: descripciones, imágenes, SEO, precio, stock, categoría. Para resolver referencias como "el segundo", usá primero search_products y pasá el id de la posición correspondiente.',
  permissionClass: 'R',
  paramSchema: getProductSchema,
  handler: async (params, ctx) => {
    const product = await ctx.adapter.getProduct(params.product_id);
    if (!product) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${params.product_id}'`, {
        hint: 'Usá search_products para obtener el product_id correcto (o la posición en la última búsqueda).',
      });
    }
    return {
      data: product,
      entityType: 'product',
      entityId: product.id,
      sessionUpdate: { lastFocusProductId: product.id },
    };
  },
};

const salesReportSchema = z.object({
  period: emptyAsUndefined(z.string().min(1).default('this_month')),
  group_by: emptyAsUndefined(z.enum(['product', 'category', 'day']).default('product')),
  compare: emptyAsUndefined(optionalBoolean.default(false)),
});

const getSalesReport: ToolDefinition<z.infer<typeof salesReportSchema>> = {
  name: 'get_sales_report',
  description:
    'Reporte de ventas por período: total facturado, cantidad de pedidos, unidades, ticket promedio y ranking (por producto, categoría o día). Período: today, yesterday, this_week, last_week, this_month, last_month, this_year, last_year o YYYY-MM (ej: 2026-08). Con compare=true agrega el período anterior para comparar.',
  permissionClass: 'R',
  paramSchema: salesReportSchema,
  handler: async (params, ctx) => {
    const range = parsePeriod(params.period);
    const previous = params.compare ? previousPeriod(params.period) : null;
    const report = await ctx.adapter.getSalesReport(range, previous, params.group_by);
    return { data: report, entityType: 'sales_report' };
  },
};

const inventoryReportSchema = z.object({
  filter: emptyAsUndefined(z.enum(['low_stock', 'out_of_stock', 'all']).default('all')),
  threshold: emptyAsUndefined(z.coerce.number().int().min(0).default(5)),
});

const getInventoryReport: ToolDefinition<z.infer<typeof inventoryReportSchema>> = {
  name: 'get_inventory_report',
  description:
    'Reporte de inventario: productos con stock bajo (filter=low_stock), sin stock (filter=out_of_stock) o completo (filter=all, incluye los de mayor rotación de los últimos 30 días). El umbral de stock bajo se ajusta con threshold (default 5).',
  permissionClass: 'R',
  paramSchema: inventoryReportSchema,
  handler: async (params, ctx) => {
    const report = await ctx.adapter.getInventoryReport(params.threshold);
    if (params.filter === 'low_stock') {
      return { data: { threshold: report.threshold, lowStock: report.lowStock }, entityType: 'inventory_report' };
    }
    if (params.filter === 'out_of_stock') {
      return { data: { outOfStock: report.outOfStock }, entityType: 'inventory_report' };
    }
    return { data: report, entityType: 'inventory_report' };
  },
};

export function registerReadTools(registry: ToolRegistry): void {
  registry.register([searchProducts, getProduct, getSalesReport, getInventoryReport]);
}
