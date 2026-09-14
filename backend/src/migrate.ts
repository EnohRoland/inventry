import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool, transaction } from './db.js';
export async function migrate() {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(742193)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
      if ((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount)
        continue;
      await client.query(await readFile(new URL(name, dir), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      console.log(`Applied ${name}`);
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exitCode = 1;
    });
}
