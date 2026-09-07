import { z } from 'zod';
import { AppError } from '../errors.js';
import type { ToolDefinition, ToolRegistry } from '../agent/tool-registry.js';

const updateStockSchema = z.object({
  product_id: z.string().min(1),
  new_stock: z.coerce.number().int().min(0),
});

const updatePriceSchema = z.object({
  product_id: z.string().min(1),
  new_price: z.coerce.number().int().min(0),
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

/**
 * W2: cambio de precio. Read-modify-write sobre la tienda; audita diff.
 */
const updateProductPrice: ToolDefinition<z.infer<typeof updatePriceSchema>> = {
  name: 'update_product_price',
  description:
    'Cambia el precio de un producto. Se aplica directamente. Argumentos: product_id (ID numérico) y new_price (entero en guaraníes, >= 0). Devuelve el resultado con el valor anterior y el nuevo.',
  permissionClass: 'W2',
  paramSchema: updatePriceSchema,
  handler: async (params, ctx) => {
    const product = await ctx.adapter.getProduct(params.product_id);
    if (!product) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${params.product_id}'`, {
        hint: 'Usá search_products para obtener el product_id correcto.',
      });
    }
    if (product.price === params.new_price) {
      return {
        data: {
          no_change: true,
          message: `El precio de '${product.name}' (#${product.id}) ya es ${params.new_price}; no hay nada que cambiar.`,
        },
        entityType: 'product',
        entityId: product.id,
      };
    }

    const before = product.price;
    const updated = await ctx.adapter.updateProductPrice(params.product_id, params.new_price);

    return {
      data: {
        updated: true,
        message: `Precio actualizado: ${updated.name} #${updated.id}: $${before} → $${updated.price}`,
        before,
        after: updated.price,
        product: updated,
      },
      entityType: 'product',
      entityId: updated.id,
      diff: { price: { before, after: updated.price } },
    };
  },
};

const setActiveSchema = z.object({
  product_id: z.string().min(1),
  active: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true'),
});

/**
 * W2: publicar/despublicar. Usa el toggle dirigido de la tienda.
 */
const setProductActive: ToolDefinition<z.infer<typeof setActiveSchema>> = {
  name: 'set_product_active',
  description:
    'Publica (active=true) o despublica (active=false) un producto de la tienda. Se aplica directamente. Argumentos: product_id (ID numérico) y active (true o false).',
  permissionClass: 'W2',
  paramSchema: setActiveSchema,
  handler: async (params, ctx) => {
    const product = await ctx.adapter.getProduct(params.product_id);
    if (!product) {
      throw new AppError('NOT_FOUND', `No encontré el producto '${params.product_id}'`, {
        hint: 'Usá search_products para obtener el product_id correcto.',
      });
    }
    const targetStatus = params.active ? 'published' : 'draft';
    if (product.status === targetStatus) {
      return {
        data: {
          no_change: true,
          message: `El producto '${product.name}' (#${product.id}) ya está ${targetStatus === 'published' ? 'publicado' : 'despublicado'}.`,
        },
        entityType: 'product',
        entityId: product.id,
      };
    }

    const updated = await ctx.adapter.setProductActive(params.product_id, params.active);

    return {
      data: {
        updated: true,
        message: `Producto ${updated.status === 'published' ? 'publicado' : 'despublicado'}: ${updated.name} #${updated.id}`,
        status: updated.status,
        product: updated,
      },
      entityType: 'product',
      entityId: updated.id,
      diff: { status: { before: product.status, after: updated.status } },
    };
  },
};

export function registerWriteTools(registry: ToolRegistry): void {
  registry.register([updateProductStock, updateProductPrice, setProductActive]);
}
