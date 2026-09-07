import { z } from 'zod';
import { AppError } from '../errors.js';
import type { ToolDefinition, ToolRegistry } from '../agent/tool-registry.js';

const updateStockSchema = z.object({
  product_id: z.string().min(1),
  new_stock: z.coerce.number().int().min(0),
});

/**
 * W1: cambio de stock directo. El dueño del bot decidió ejecutar sin
 * confirmación por botones (allowlist de un solo chat). La escritura usa
 * el endpoint dirigido de la tienda (solo columna stock) y el pipeline
 * audita el diff antes→después en audit_log.
 */
const updateProductStock: ToolDefinition<z.infer<typeof updateStockSchema>> = {
  name: 'update_product_stock',
  description:
    'Cambia el stock de un producto. Se aplica directamente. Argumentos: product_id (ID numérico) y new_stock (entero >= 0). Devuelve el resultado con el valor anterior y el nuevo.',
  permissionClass: 'W1',
  paramSchema: updateStockSchema,
  handler: async (params, ctx) => {
    const product = await ctx.adapter.getProduct(params.product_id);
    if (!product) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${params.product_id}'`, {
        hint: 'Usá search_products para obtener el product_id correcto.',
      });
    }
    if (product.stock === params.new_stock) {
      return {
        data: {
          no_change: true,
          message: `El stock de '${product.name}' (#${product.id}) ya es ${params.new_stock}; no hay nada que cambiar.`,
        },
        entityType: 'product',
        entityId: product.id,
      };
    }

    const before = product.stock;
    const updated = await ctx.adapter.updateProductStock(params.product_id, params.new_stock);

    return {
      data: {
        updated: true,
        message: `Stock actualizado: ${updated.name} #${updated.id}: ${before} → ${updated.stock}`,
        before,
        after: updated.stock,
        product: updated,
      },
      entityType: 'product',
      entityId: updated.id,
      diff: { stock: { before, after: updated.stock } },
    };
  },
};

export function registerWriteTools(registry: ToolRegistry): void {
  registry.register([updateProductStock]);
}
