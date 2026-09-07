import { describe, expect, it } from 'vitest';
import { idempotencyKey, runTool } from '../src/agent/run-tool.js';
import { buildDeps } from './helpers.js';

describe('pipeline de ejecución (runTool)', () => {
  it('repite la misma respuesta ante un retry con el mismo request_id, sin re-ejecutar la tool', async () => {
    const deps = buildDeps({ countingAdapter: true });
    const input = {
      toolName: 'search_products',
      params: { query: 'magnesio' },
      sessionKey: 'tg_1',
      requestId: 'exec-1',
    };
    const first = await runTool(input, deps);
    const second = await runTool(input, deps);

    expect(first.response.ok).toBe(true);
    expect(second.response).toMatchObject({ ok: true });
    expect((second.response.meta as Record<string, unknown>)?.idempotentReplay).toBe(true);
    expect(deps.adapter.calls.searchProducts).toBe(1);

    const entries = await deps.stores.audit.query({ sessionKey: 'tg_1' });
    expect(entries.filter((e) => e.status === 'idempotent_replay')).toHaveLength(1);
  });

  it('rechaza con RATE_LIMITED y lo audita como rejected cuando se supera el límite', async () => {
    const deps = buildDeps({ rateLimit: 2 });
    await runTool({ toolName: 'search_products', params: {}, sessionKey: 'tg_1' }, deps);
    await runTool({ toolName: 'search_products', params: {}, sessionKey: 'tg_1' }, deps);
    const third = await runTool({ toolName: 'search_products', params: {}, sessionKey: 'tg_1' }, deps);

    expect(third.httpStatus).toBe(429);
    expect(third.response.error?.code).toBe('RATE_LIMITED');
    const entries = await deps.stores.audit.query({ sessionKey: 'tg_1' });
    expect(entries.some((e) => e.status === 'rejected' && e.error?.code === 'RATE_LIMITED')).toBe(true);
  });

  it('herramienta desconocida devuelve TOOL_NOT_FOUND con la lista de disponibles en el hint', async () => {
    const deps = buildDeps();
    const outcome = await runTool({ toolName: 'borrar_todo', sessionKey: 'tg_1' }, deps);
    expect(outcome.httpStatus).toBe(404);
    expect(outcome.response.error?.code).toBe('TOOL_NOT_FOUND');
    expect(outcome.response.error?.hint).toContain('search_products');
  });

  it('parámetros inválidos devuelven VALIDATION con hint del campo y queda auditado', async () => {
    const deps = buildDeps();
    const outcome = await runTool({ toolName: 'get_product', params: {}, sessionKey: 'tg_1' }, deps);
    expect(outcome.httpStatus).toBe(422);
    expect(outcome.response.error?.code).toBe('VALIDATION');
    expect(outcome.response.error?.hint).toContain('product_id');

    const entries = await deps.stores.audit.query({ sessionKey: 'tg_1' });
    expect(entries.at(-1)?.status).toBe('rejected');
  });

  it('la clave de idempotencia separa sesión, request y tool', () => {
    expect(idempotencyKey('tg_1', 'exec-1', 'a')).not.toBe(idempotencyKey('tg_1', 'exec-1', 'b'));
    expect(idempotencyKey('tg_1', 'exec-1', 'a')).not.toBe(idempotencyKey('tg_2', 'exec-1', 'a'));
  });
});
