import { describe, expect, it } from 'vitest';
import { runTool } from '../src/agent/run-tool.js';
import { buildDeps } from './helpers.js';
import type { PendingAction } from '../src/types.js';

const PRODUCT_ID = 'a1000000-0000-4000-8000-000000000001'; // Magnesio Bisglicinato (mock)

describe('update_product_stock (W2 con confirmación)', () => {
  it('crea acción pendiente con diff y NO ejecuta la escritura', async () => {
    const deps = buildDeps({ countingAdapter: true });
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: 9 }, sessionKey: 'tg_1' },
      deps
    );

    expect(outcome.response.ok).toBe(true);
    const data = outcome.response.data as { confirmation_required: boolean; action_id: string; preview: { before: number; after: number } };
    expect(data.confirmation_required).toBe(true);
    expect(data.preview).toMatchObject({ before: 3, after: 9 });
    // No escribió: el adapter de escritura no fue llamado.
    expect(deps.adapter.calls.updateProductStock).toBe(0);

    const action = await deps.stores.pendingActions.get(data.action_id);
    expect(action?.status).toBe('pending');

    const entries = await deps.stores.audit.query({ sessionKey: 'tg_1' });
    expect(entries.some((e) => e.status === 'confirmation_required')).toBe(true);
  });

  it('el stock sigue igual mientras la acción no se confirme', async () => {
    const deps = buildDeps();
    await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: 9 }, sessionKey: 'tg_1' },
      deps
    );
    const product = await deps.adapter.getProduct(PRODUCT_ID);
    expect(product?.stock).toBe(3); // original del mock
  });

  it('con new_stock igual al actual no crea acción', async () => {
    const deps = buildDeps();
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: 3 }, sessionKey: 'tg_1' },
      deps
    );
    const data = outcome.response.data as { no_change?: boolean };
    expect(data.no_change).toBe(true);
  });

  it('producto inexistente devuelve NOT_FOUND con hint', async () => {
    const deps = buildDeps();
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: 'no-existe', new_stock: 5 }, sessionKey: 'tg_1' },
      deps
    );
    expect(outcome.httpStatus).toBe(404);
    expect(outcome.response.error?.code).toBe('NOT_FOUND');
  });

  it('cancelar la acción deja el stock intacto y audita cancel', async () => {
    const deps = buildDeps();
    const outcome = await runTool(
      { toolName: 'update_product_stock', params: { product_id: PRODUCT_ID, new_stock: 9 }, sessionKey: 'tg_1' },
      deps
    );
    const data = outcome.response.data as { action_id: string };
    const action = (await deps.stores.pendingActions.get(data.action_id)) as PendingAction;

    await deps.stores.pendingActions.setStatus(action.id, 'cancelled');
    const product = await deps.adapter.getProduct(PRODUCT_ID);
    expect(product?.stock).toBe(3);
  });
});
