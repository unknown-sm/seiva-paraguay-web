import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 10 });
}

/**
 * Runner de migraciones minimalista: aplica migrations/*.sql en orden,
 * una por transacción, registrando las aplicadas en schema_migrations.
 */
export async function migrate(pool: Pool, migrationsDir = 'migrations'): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );

  const files = fs
    .readdirSync(path.resolve(process.cwd(), migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const already = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (already.rowCount) continue;
    const sql = fs.readFileSync(path.resolve(process.cwd(), migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}
