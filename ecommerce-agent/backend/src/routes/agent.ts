import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { runTool } from '../agent/run-tool.js';
import type { ToolRegistry } from '../agent/tool-registry.js';
import type { EcommerceAdapter } from '../ecommerce/adapter.js';
import type { RateLimiter } from '../rateLimit.js';
import type { Stores } from '../stores/types.js';
import type { PendingAction } from '../types.js';

export interface AgentRouteDeps {
  apiKeys: string[];
  registry: ToolRegistry;
  stores: Stores;
  adapter: EcommerceAdapter;
  limiter: RateLimiter;
}

const toolCallBody = z.object({
  params: z.record(z.unknown()).optional(),
  context: z
    .object({
      session_key: z.string().min(1).optional(),
      user_id: z.string().min(1).optional(),
      request_id: z.string().min(1).optional(),
    })
    .optional(),
});

const createActionBody = z.object({
  tool: z.string().min(1),
  params: z.unknown().optional(),
  preview: z.unknown().optional(),
  expires_in_minutes: z.coerce.number().int().min(1).max(1440).default(15),
  context: z
    .object({
      session_key: z.string().min(1).optional(),
      user_id: z.string().min(1).optional(),
    })
    .optional(),
});

function publicAction(a: PendingAction) {
  return {
    action_id: a.id,
    tool: a.tool,
    params: a.params,
    preview: a.preview,
    status: a.status,
    expires_at: a.expiresAt,
  };
}

export async function agentRoutes(app: FastifyInstance, deps: AgentRouteDeps): Promise<void> {
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !deps.apiKeys.includes(token)) {
      throw new AppError('UNAUTHORIZED', 'API key inválida o ausente', {
        hint: 'Enviá el header "Authorization: Bearer <AGENT_API_KEY>".',
      });
    }
  });

  app.post<{ Params: { toolName: string } }>('/tools/:toolName', async (req, reply) => {
    const parsed = toolCallBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Body inválido', {
        hint: 'Formato esperado: { "params": { ... }, "context": { "session_key": "tg_123", "request_id": "..." } }',
      });
    }
    const outcome = await runTool(
      {
        toolName: req.params.toolName,
        params: parsed.data.params,
        sessionKey: parsed.data.context?.session_key ?? 'unknown-session',
        userId: parsed.data.context?.user_id,
        requestId: parsed.data.context?.request_id,
      },
      { registry: deps.registry, stores: deps.stores, limiter: deps.limiter, adapter: deps.adapter }
    );
    return reply.code(outcome.httpStatus).send(outcome.response);
  });

  // ---- Acciones pendientes (confirmaciones por botones inline de Telegram) ----
  // La ejecución real de acciones confirmadas se conecta en Fase 2 junto con
  // las tools de escritura; desde ya crea/confirma/cancela y audita.

  app.post<{ Params: { id: string } }>('/actions/:id/confirm', async (req, reply) => {
    const action = await deps.stores.pendingActions.get(req.params.id);
    if (!action) throw new AppError('NOT_FOUND', `Acción '${req.params.id}' inexistente`);

    const body = (req.body ?? {}) as { context?: { user_id?: string } };
    const confirmer = body.context?.user_id;
    if (confirmer && confirmer !== action.createdBy) {
      throw new AppError('FORBIDDEN', 'Solo quien originó la acción puede confirmarla');
    }

    if (action.status !== 'pending') {
      throw new AppError('INVALID_STATE', `La acción ya está ${action.status}`);
    }
    if (new Date(action.expiresAt) < new Date()) {
      await deps.stores.pendingActions.setStatus(action.id, 'expired');
      await deps.stores.audit.append({
        sessionKey: action.sessionKey,
        userId: action.userId,
        tool: `${action.tool}:confirm`,
        status: 'expired',
        error: { code: 'INVALID_STATE', message: 'Confirmación fuera de tiempo' },
      });
      throw new AppError('INVALID_STATE', 'La acción expiró', { hint: 'Pedile al asistente que la genere de nuevo.' });
    }

    await deps.stores.pendingActions.setStatus(action.id, 'confirmed');
    await deps.stores.audit.append({
      sessionKey: action.sessionKey,
      userId: action.userId,
      tool: `${action.tool}:confirm`,
      params: action.params,
      status: 'ok',
      entityType: 'pending_action',
      entityId: action.id,
    });

    // Fase 2: ejecución real de la acción confirmada.
    if (action.tool === 'update_product_stock') {
      const p = z.object({ product_id: z.string().min(1), new_stock: z.coerce.number().int().min(0) }).safeParse(action.params);
      if (!p.success) {
        throw new AppError('INVALID_STATE', 'Params de la acción inválidos');
      }
      const preview = (action.preview ?? {}) as { name?: string; before?: number };
      try {
        const updated = await deps.adapter.updateProductStock(p.data.product_id, p.data.new_stock);
        await deps.stores.audit.append({
          sessionKey: action.sessionKey,
          userId: action.userId,
          tool: action.tool,
          params: action.params,
          status: 'ok',
          entityType: 'product',
          entityId: updated.id,
          diff: { stock: { before: preview.before ?? null, after: updated.stock } },
        });
        return {
          ok: true,
          data: {
            action_id: action.id,
            status: 'confirmed',
            executed: true,
            summary: `Stock actualizado: ${updated.name} #${updated.id} → ${updated.stock}`,
            product: updated,
          },
        };
      } catch (e) {
        const appErr = e instanceof AppError ? e : new AppError('INTERNAL', 'Error ejecutando el cambio de stock');
        await deps.stores.audit.append({
          sessionKey: action.sessionKey,
          userId: action.userId,
          tool: action.tool,
          params: action.params,
          status: 'error',
          error: { code: appErr.code, message: appErr.message },
          entityType: 'product',
          entityId: p.data.product_id,
        });
        throw appErr;
      }
    }

    return {
      ok: true,
      data: {
        action_id: action.id,
        status: 'confirmed',
        note: 'Acción confirmada. La ejecución se conecta en Fase 2 (tools de escritura).',
      },
    };
  });

  app.post<{ Params: { id: string } }>('/actions/:id/cancel', async (req, reply) => {
    const action = await deps.stores.pendingActions.get(req.params.id);
    if (!action) throw new AppError('NOT_FOUND', `Acción '${req.params.id}' inexistente`);
    if (action.status !== 'pending') {
      throw new AppError('INVALID_STATE', `La acción ya está ${action.status}`);
    }
    await deps.stores.pendingActions.setStatus(action.id, 'cancelled');
    await deps.stores.audit.append({
      sessionKey: action.sessionKey,
      userId: action.userId,
      tool: `${action.tool}:cancel`,
      status: 'ok',
      entityType: 'pending_action',
      entityId: action.id,
    });
    return { ok: true, data: { action_id: action.id, status: 'cancelled' } };
  });

  app.get<{ Params: { id: string } }>('/actions/:id', async (req, reply) => {
    const action = await deps.stores.pendingActions.get(req.params.id);
    if (!action) throw new AppError('NOT_FOUND', `Acción '${req.params.id}' inexistente`);
    return { ok: true, data: publicAction(action) };
  });

  app.post('/actions', async (req, reply) => {
    const parsed = createActionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Body inválido', {
        hint: "Formato: { \"tool\": \"...\", \"params\": {...}, \"preview\": {...}, \"expires_in_minutes\": 15, \"context\": { \"session_key\": \"...\", \"user_id\": \"...\" } }",
      });
    }
    const b = parsed.data;
    const sessionKey = b.context?.session_key ?? 'unknown-session';
    const userId = b.context?.user_id ?? 'admin';
    const action: PendingAction = {
      id: `act_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      sessionKey,
      userId,
      tool: b.tool,
      params: b.params ?? null,
      preview: b.preview ?? null,
      status: 'pending',
      createdBy: userId,
      expiresAt: new Date(Date.now() + b.expires_in_minutes * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await deps.stores.pendingActions.create(action);
    await deps.stores.audit.append({
      sessionKey,
      userId,
      tool: `${action.tool}:pending`,
      params: action.params,
      status: 'confirmation_required',
      entityType: 'pending_action',
      entityId: action.id,
    });
    return reply.code(201).send({ ok: true, data: publicAction(action) });
  });

  app.get('/audit', async (req, reply) => {
    const q = z
      .object({
        session_key: z.string().optional(),
        tool: z.string().optional(),
        entity_id: z.string().optional(),
        status: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(50),
      })
      .safeParse(req.query ?? {});
    if (!q.success) {
      throw new AppError('VALIDATION', 'Parámetros de query inválidos', { hint: 'Usá session_key, tool, entity_id, status, limit.' });
    }
    const entries = await deps.stores.audit.query({
      sessionKey: q.data.session_key,
      tool: q.data.tool,
      entityId: q.data.entity_id,
      status: q.data.status as never,
      limit: q.data.limit,
    });
    return { ok: true, data: { count: entries.length, entries } };
  });
}
