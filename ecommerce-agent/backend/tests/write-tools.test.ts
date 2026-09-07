import { describe, expect, it } from 'vitest';
import { runTool } from '../src/agent/run-tool.js';
import { buildDeps } from './helpers.js';

const PRODUCT_ID = 'a1000000-0000-4000-8000-000000000001'; // Magnesio Bisglicinato (mock, stock 3)

describe('update_product_stock (W1 directo)', () => {
  it('aplica el cambio y devuelve diff antes→después', async () => {
    const deps = buildDeps({ countingAdapter: true });
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: 9 }, sessionKey: 'tg_1', requestId: 'w1-1' },
      deps
    );

    expect(outcome.response.ok).toBe(true);
    const data = outcome.response.data as { updated: boolean; before: number; after: number };
    expect(data.updated).toBe(true);
    expect(data.before).toBe(3);
    expect(data.after).toBe(9);
    expect(deps.adapter.calls.updateProductStock).toBe(1);

    const product = await deps.adapter.getProduct(PRODUCT_ID);
    expect(product?.stock).toBe(9);

    // El pipeline audita el diff del resultado.
    const entries = await deps.stores.audit.query({ sessionKey: 'tg_1' });
    const entry = entries.find((e) => e.tool === 'update_product_stock' && e.status === 'ok');
    expect(entry?.diff).toEqual({ stock: { before: 3, after: 9 } });
  });

  it('con new_stock igual al actual no escribe', async () => {
    const deps = buildDeps({ countingAdapter: true });
    const current = (await deps.adapter.getProduct(PRODUCT_ID))!;
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: current.stock }, sessionKey: 'tg_1' },
      deps
    );
    const data = outcome.response.data as { no_change?: boolean };
    expect(data.no_change).toBe(true);
    expect(deps.adapter.calls.updateProductStock).toBe(0);
  });

  it('producto inexistente devuelve NOT_FOUND con hint y no escribe', async () => {
    const deps = buildDeps({ countingAdapter: true });
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: 'no-existe', new_stock: 5 }, sessionKey: 'tg_1' },
      deps
    );
    expect(outcome.httpStatus).toBe(404);
    expect(outcome.response.error?.code).toBe('NOT_FOUND');
    expect(deps.adapter.calls.updateProductStock).toBe(0);
  });

  it('new_stock negativo es rechazado por validación', async () => {
    const deps = buildDeps();
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: -2 }, sessionKey: 'tg_1' },
      deps
    );
    expect(outcome.httpStatus).toBe(422);
    expect(outcome.response.error?.code).toBe('VALIDATION');
  });
});
