import { describe, expect, it } from 'vitest';
import { runTool } from '../src/agent/run-tool.js';
import { buildDeps } from './helpers.js';

describe('tools de lectura', () => {
  it('search_products encuentra por texto y persiste la lista en la sesión (memoria de entidades)', async () => {
    const deps = buildDeps();
    const outcome = await runTool({ toolName: 'search_products', params: { query: 'magnesio' }, sessionKey: 'tg_1' }, deps);
    expect(outcome.httpStatus).toBe(200);
    const data = outcome.response.data as { count: number; results: Array<{ name: string }> };
    expect(data.count).toBe(2);
    expect(data.results.map((r) => r.name)).toEqual(['Magnesio Bisglicinato 60 cápsulas', 'Magnesio Marino 120 cápsulas']);

    const session = await deps.stores.sessions.get('tg_1');
    expect(session?.lastProductList).toHaveLength(2);
    expect(session?.lastProductList?.[1]).toEqual({
      position: 2,
      id: 'a1000000-0000-4000-8000-000000000002',
      name: 'Magnesio Marino 120 cápsulas',
    });
  });

  it('get_product devuelve la ficha completa y actualiza el foco de sesión', async () => {
    const deps = buildDeps();
    const outcome = await runTool(
      { toolName: 'get_product', params: { product_id: 'a1000000-0000-4000-8000-000000000006' }, sessionKey: 'tg_1' },
      deps
    );
    const product = outcome.response.data as { name: string; seo: { slug: string } };
    expect(product.name).toBe('Creatina Monohidrato 500g');
    expect(product.seo.slug).toBe('creatina-monohidrato-500g');
    expect((await deps.stores.sessions.get('tg_1'))?.lastFocusProductId).toBe('a1000000-0000-4000-8000-000000000006');
  });

  it('get_product con id inexistente devuelve NOT_FOUND con hint de recuperación', async () => {
    const deps = buildDeps();
    const outcome = await runTool({ toolName: 'get_product', params: { product_id: 'no-existe' }, sessionKey: 'tg_1' }, deps);
    expect(outcome.httpStatus).toBe(404);
    expect(outcome.response.ok).toBe(false);
    expect(outcome.response.error?.code).toBe('NOT_FOUND');
    expect(outcome.response.error?.hint).toContain('search_products');
  });

  it('get_sales_report agrupa por producto y agrega comparación cuando se pide', async () => {
    const deps = buildDeps();
    const outcome = await runTool(
      { toolName: 'get_sales_report', params: { period: 'this_month', group_by: 'product', compare: 'true' }, sessionKey: 'tg_1' },
      deps
    );
    const data = outcome.response.data as {
      totals: { orders: number; revenue: number; avgTicket: number };
      byProduct: Array<{ name: string }>;
      comparison?: { label: string };
    };
    expect(data.totals.orders).toBeGreaterThan(0);
    expect(data.totals.revenue).toBeGreaterThan(0);
    expect(data.byProduct.length).toBeGreaterThan(0);
    expect(data.comparison?.label).toBe('el mes pasado');
  });

  it('get_sales_report rechaza períodos inválidos con hint de valores válidos', async () => {
    const deps = buildDeps();
    const outcome = await runTool({ toolName: 'get_sales_report', params: { period: 'el jueves' }, sessionKey: 'tg_1' }, deps);
    expect(outcome.httpStatus).toBe(422);
    expect(outcome.response.error?.code).toBe('VALIDATION');
    expect(outcome.response.error?.hint).toContain('this_month');
  });

  it('get_inventory_report filtra stock bajo y sin stock por umbral', async () => {
    const deps = buildDeps();
    const low = await runTool(
      { toolName: 'get_inventory_report', params: { filter: 'low_stock', threshold: '5' }, sessionKey: 'tg_1' },
      deps
    );
    const lowData = low.response.data as { lowStock: Array<{ name: string; stock: number }> };
    expect(lowData.lowStock.map((p) => p.name).sort()).toEqual(['Colágeno Hidrolizado 300g', 'Magnesio Bisglicinato 60 cápsulas']);

    const out = await runTool({ toolName: 'get_inventory_report', params: { filter: 'out_of_stock' }, sessionKey: 'tg_1' }, deps);
    const outData = out.response.data as { outOfStock: Array<{ name: string }> };
    expect(outData.outOfStock.map((p) => p.name)).toEqual(['Vitamina D3 2000 UI']);
  });
});
