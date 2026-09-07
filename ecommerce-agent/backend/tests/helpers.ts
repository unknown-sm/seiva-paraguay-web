import type { RunToolDeps } from '../src/agent/run-tool.js';
import { ToolRegistry } from '../src/agent/tool-registry.js';
import { registerReadTools } from '../src/tools/read-tools.js';
import { registerWriteTools } from '../src/tools/write-tools.js';
import { MockEcommerceAdapter } from '../src/ecommerce/mock-adapter.js';
import { createMemoryStores } from '../src/stores/memory.js';
import { RateLimiter } from '../src/rateLimit.js';
import type { EcommerceAdapter } from '../src/ecommerce/adapter.js';

export interface CountingAdapter extends EcommerceAdapter {
  calls: {
    searchProducts: number;
    getProduct: number;
    getSalesReport: number;
    getInventoryReport: number;
    updateProductStock: number;
    updateProductPrice: number;
    setProductActive: number;
  };
}

export function buildDeps(opts?: { rateLimit?: number; countingAdapter?: boolean }): RunToolDeps & { adapter: CountingAdapter } {
  const base = new MockEcommerceAdapter();
  const calls = {
    searchProducts: 0,
    getProduct: 0,
    getSalesReport: 0,
    getInventoryReport: 0,
    updateProductStock: 0,
    updateProductPrice: 0,
    setProductActive: 0,
  };
  const adapter: CountingAdapter = {
    calls,
    searchProducts: (...args) => {
      calls.searchProducts++;
      return base.searchProducts(...args);
    },
    getProduct: (...args) => {
      calls.getProduct++;
      return base.getProduct(...args);
    },
    getSalesReport: (...args) => {
      calls.getSalesReport++;
      return base.getSalesReport(...args);
    },
    getInventoryReport: (...args) => {
      calls.getInventoryReport++;
      return base.getInventoryReport(...args);
    },
    updateProductStock: (...args) => {
      calls.updateProductStock++;
      return base.updateProductStock(...args);
    },
    updateProductPrice: (...args) => {
      calls.updateProductPrice++;
      return base.updateProductPrice(...args);
    },
    setProductActive: (...args) => {
      calls.setProductActive++;
      return base.setProductActive(...args);
    },
  };

  const registry = new ToolRegistry();
  registerReadTools(registry);
  registerWriteTools(registry);

  return {
    registry,
    stores: createMemoryStores(),
    limiter: new RateLimiter(opts?.rateLimit ?? 1000),
    adapter: opts?.countingAdapter ? adapter : (base as never),
  } as never as RunToolDeps & { adapter: CountingAdapter };
}
