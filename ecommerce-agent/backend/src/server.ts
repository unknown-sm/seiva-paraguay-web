import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { createPool } from './db.js';
import { ToolRegistry } from './agent/tool-registry.js';
import { registerReadTools } from './tools/read-tools.js';
import { RateLimiter } from './rateLimit.js';
import { MockEcommerceAdapter } from './ecommerce/mock-adapter.js';
import { createMemoryStores } from './stores/memory.js';
import { createPostgresStores } from './stores/postgres.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const stores = config.mockMode
    ? createMemoryStores()
    : createPostgresStores(createPool(config.databaseUrl!));

  // Fase 1: adapter mock. La implementación real sobre los servicios del
  // ecommerce reemplaza esta línea sin tocar el resto del sistema.
  const adapter = new MockEcommerceAdapter();

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
