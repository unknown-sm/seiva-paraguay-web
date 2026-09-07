import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { createPool } from './db.js';
import { ToolRegistry } from './agent/tool-registry.js';
import { registerReadTools } from './tools/read-tools.js';
import { RateLimiter } from './rateLimit.js';
import { MockEcommerceAdapter } from './ecommerce/mock-adapter.js';
import { StoreApiAdapter } from './ecommerce/store-api-adapter.js';
import { createMemoryStores } from './stores/memory.js';
import { createPostgresStores } from './stores/postgres.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const stores = config.mockMode
    ? createMemoryStores()
    : createPostgresStores(createPool(config.databaseUrl!));

  // Datos de productos: si STORE_API_URL apunta a la tienda, lee el catálogo
  // real vía su API pública (solo lectura); si no, usa el adapter mock.
  const adapter = config.storeApiUrl
    ? new StoreApiAdapter(config.storeApiUrl)
    : new MockEcommerceAdapter();

  const registry = new ToolRegistry();
  registerReadTools(registry);

  const limiter = new RateLimiter(config.rateLimitPerMinute);

  const app = buildApp({
    apiKeys: config.apiKeys,
    registry,
    stores,
    adapter,
    limiter,
    mode: config.mockMode ? 'mock' : 'postgres',
    logLevel: config.logLevel,
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(
    `Agent API lista en :${config.port} | modo=${config.mockMode ? 'mock' : 'postgres'} | tools=${registry.names().join(', ')}`
  );
  if (!config.mockMode) {
    app.log.info('Recordá correr las migraciones si es la primera vez: npm run migrate');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
