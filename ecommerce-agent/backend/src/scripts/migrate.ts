import { loadConfig } from '../config.js';
import { createPool, migrate } from '../db.js';

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.databaseUrl) {
    console.error('DATABASE_URL no está definida. Configurá .env (ver .env.example) o usá MOCK_MODE=1.');
    process.exit(1);
  }
  const pool = createPool(config.databaseUrl);
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Nada pendiente; la base ya está al día.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
