import type { ZodError } from 'zod';
import { AppError, statusForCode } from '../errors.js';
import type { AuditEntry, AuditStatus, ToolResponse } from '../types.js';
import type { EcommerceAdapter } from '../ecommerce/adapter.js';
import type { RateLimiter } from '../rateLimit.js';
import type { Stores } from '../stores/types.js';
import { assertPermission } from './permissions.js';
import type { ToolContext, ToolDefinition, ToolRegistry } from './tool-registry.js';

export interface RunToolInput {
  toolName: string;
  params?: unknown;
  sessionKey: string;
  userId?: string;
  requestId?: string;
  role?: string;
}

export interface RunToolDeps {
  registry: ToolRegistry;
  stores: Stores;
  limiter: RateLimiter;
  adapter: EcommerceAdapter;
}

export interface RunToolOutcome {
  response: ToolResponse;
  httpStatus: number;
}

/**
 * Denegaciones previas a la ejecución: se auditan como 'rejected' en lugar
 * de 'error' para distinguir intentos bloqueados de fallos reales.
 */
const REJECTED_CODES = new Set(['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'RATE_LIMITED', 'TOOL_NOT_FOUND', 'INVALID_STATE']);

export function idempotencyKey(sessionKey: string, requestId: string, toolName: string): string {
  return `${sessionKey}::${requestId}::${toolName}`;
}

function describeZodError(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'params'}: ${i.message}`).join('; ');
}

function zodHint(def: ToolDefinition, error: ZodError): string {
  const first = error.issues[0];
  const path = first?.path.join('.') || 'params';
  return `Campo '${path}': ${first?.message ?? 'inválido'}. Tool: ${def.name} (${def.description.split('.')[0]})`;
}

/**
 * Pipeline de ejecución de una tool:
 * rate limit → idempotencia → lookup → validación → permisos → handler →
 * memoria de sesión → respuesta + auditoría. Toda salida queda auditada.
 */
export async function runTool(input: RunToolInput, deps: RunToolDeps): Promise<RunToolOutcome> {
  const { registry, stores, limiter, adapter } = deps;
  const sessionKey = input.sessionKey?.trim() || 'unknown-session';
  const userId = input.userId?.trim() || 'admin';
  const role = input.role?.trim() || 'admin';
  const startedAt = Date.now();
  const key = input.requestId ? idempotencyKey(sessionKey, input.requestId, input.toolName) : null;

  const audit = async (partial: {
    tool: string;
    status: AuditStatus;
    params?: unknown;
    error?: AuditEntry['error'];
    entityType?: string | null;
    entityId?: string | null;
    diff?: AuditEntry['diff'];
  }) => {
    await stores.audit.append({
      sessionKey,
      userId,
      tool: partial.tool,
      params: partial.params,
      status: partial.status,
      error: partial.error ?? null,
      entityType: partial.entityType ?? null,
      entityId: partial.entityId ?? null,
      diff: partial.diff ?? null,
      requestId: input.requestId ?? null,
      durationMs: Date.now() - startedAt,
    });
  };

  const toOutcome = (response: ToolResponse): RunToolOutcome => ({
    response,
    httpStatus: response.ok ? 200 : statusForCode(response.error?.code ?? 'INTERNAL'),
  });

  if (!limiter.check(sessionKey)) {
    const err = { code: 'RATE_LIMITED', message: 'Demasiadas ejecuciones de tools por minuto para esta sesión', hint: 'Esperá unos segundos antes de reintentar.' };
    await audit({ tool: input.toolName, status: 'rejected', error: err });
    return toOutcome({ ok: false, error: err });
  }

  if (key) {
    const previous = await stores.idempotency.getResponse(key);
    if (previous) {
      await audit({ tool: input.toolName, status: 'idempotent_replay' });
      return toOutcome({ ...previous, meta: { ...(previous.meta ?? {}), idempotentReplay: true } });
    }
  }

  try {
    const def = registry.get(input.toolName);

    const parsed = def.paramSchema.safeParse(input.params ?? {});
    if (!parsed.success) {
      throw new AppError('VALIDATION', `Parámetros inválidos: ${describeZodError(parsed.error)}`, {
        hint: zodHint(def, parsed.error),
      });
    }

    assertPermission(role, def.permissionClass);

    const ctx: ToolContext = { sessionKey, userId, requestId: input.requestId ?? '', role, adapter, stores };
    const result = await def.handler(parsed.data, ctx);

    if (result.sessionUpdate) {
      const existing = (await stores.sessions.get(sessionKey)) ?? { sessionKey, role };
      await stores.sessions.save({ ...existing, role, ...result.sessionUpdate });
    }

    const okResponse: ToolResponse = { ok: true, data: result.data };
    if (key) await stores.idempotency.saveResponse(key, okResponse);

    await audit({
      tool: def.name,
      params: parsed.data,
      status: 'ok',
      entityType: result.entityType,
      entityId: result.entityId,
      diff: result.diff,
    });
    return toOutcome(okResponse);
  } catch (e) {
    const appErr = e instanceof AppError ? e : new AppError('INTERNAL', 'Error interno ejecutando la tool');
    const errorBody = {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.hint ? { hint: appErr.hint } : {}),
    };
    await audit({
      tool: input.toolName,
      params: input.params,
      status: REJECTED_CODES.has(appErr.code) ? 'rejected' : 'error',
      error: errorBody,
    });
    return toOutcome({ ok: false, error: errorBody });
  }
}
