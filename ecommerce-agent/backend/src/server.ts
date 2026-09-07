import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { createPool, migrate } from './db.js';
import { ToolRegistry } from './agent/tool-registry.js';
import { registerReadTools } from './tools/read-tools.js';
import { registerWriteTools } from './tools/write-tools.js';
import { RateLimiter } from './rateLimit.js';
import { MockEcommerceAdapter } from './ecommerce/mock-adapter.js';
import { StoreApiAdapter } from './ecommerce/store-api-adapter.js';
import { createMemoryStores } from './stores/memory.js';
import { createPostgresStores } from './stores/postgres.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const pool = config.mockMode ? null : createPool(config.databaseUrl!);
  const stores = config.mockMode ? createMemoryStores() : createPostgresStores(pool!);
  if (pool) {
    // Migraciones idempotentes al arranque (registradas en schema_migrations).
    const applied = await migrate(pool);
    if (applied.length) {
      console.log(`Migraciones aplicadas: ${applied.join(', ')}`);
    }
  }

  // Datos de productos: si STORE_API_URL apunta a la tienda, lee el catálogo
  // real vía su API pública (solo lectura); si no, usa el adapter mock.
  // STORE_API_USER/PASSWORD habilitan la escritura confirmada (Fase 2).
  const adapter = config.storeApiUrl
    ? new StoreApiAdapter(
        config.storeApiUrl,
        config.storeApiUser && config.storeApiPassword
          ? { username: config.storeApiUser, password: config.storeApiPassword }
          : undefined
      )
    : new MockEcommerceAdapter();

  const registry = new ToolRegistry();
  registerReadTools(registry);
  registerWriteTools(registry);

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
