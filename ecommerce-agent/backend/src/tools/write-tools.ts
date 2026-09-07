import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../errors.js';
import type { PendingAction } from '../types.js';
import type { ToolDefinition, ToolRegistry } from '../agent/tool-registry.js';

const CONFIRM_MINUTES = 15;

const updateStockSchema = z.object({
  product_id: z.string().min(1),
  new_stock: z.coerce.number().int().min(0),
});

/**
 * W2: cambio de stock. NUNCA escribe directo: crea una acción pendiente con
 * el diff antes→después y devuelve confirmation_required. La escritura real
 * ocurre en POST /agent/v1/actions/:id/confirm (botones inline de Telegram).
 */
const updateProductStock: ToolDefinition<z.infer<typeof updateStockSchema>> = {
  name: 'update_product_stock',
  description:
    'Propone cambiar el stock de un producto. NO aplica el cambio: devuelve una acción pendiente que el usuario confirma con botones (expira en 15 minutos). Usala cuando el usuario pida cambiar/modificar el stock de un producto.',
  permissionClass: 'W2',
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

    const action: PendingAction = {
      id: `act_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      sessionKey: ctx.sessionKey,
      userId: ctx.userId,
      tool: 'update_product_stock',
      params,
      preview: {
        product_id: product.id,
        name: product.name,
        before: product.stock,
        after: params.new_stock,
      },
      status: 'pending',
      createdBy: ctx.userId,
      expiresAt: new Date(Date.now() + CONFIRM_MINUTES * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await ctx.stores.pendingActions.create(action);
    await ctx.stores.audit.append({
      sessionKey: ctx.sessionKey,
      userId: ctx.userId,
      tool: 'update_product_stock:pending',
      params,
      status: 'confirmation_required',
      entityType: 'pending_action',
      entityId: action.id,
    });

    return {
      data: {
        confirmation_required: true,
        action_id: action.id,
        expires_at: action.expiresAt,
        preview: action.preview,
        instruction:
          `Mostrale al usuario el resumen del cambio (stock ${product.stock} → ${params.new_stock}) ` +
          `con los botones de confirmar/cancelar que acompañan tu mensaje. Incluí el id de acción ${action.id} en tu respuesta.`,
      },
      entityType: 'pending_action',
      entityId: action.id,
    };
  },
};

export function registerWriteTools(registry: ToolRegistry): void {
  registry.register([updateProductStock]);
}
