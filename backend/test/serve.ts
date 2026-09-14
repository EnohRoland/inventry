// Ephemeral real SQL database for browser tests. Never used by the application image.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/domain.js';
process.env.APP_ORIGIN = 'http://localhost:8080';
process.env.NODE_ENV = 'test';
const { pool } = await import('../src/db.js');
const db = new PGlite();
await db.exec(await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8'));
await db.exec('CREATE TABLE schema_migrations(name text PRIMARY KEY)');
let tail = Promise.resolve();
async function lock() {
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>((r) => {
    release = r;
  });
  await previous;
  return release;
}
const query = async (sql: string, values?: unknown[]) => {
  const r = await db.query(sql, values);
  return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
};
pool.query = (async (sql: string, values?: unknown[]) => {
  const release = await lock();
  try {
    return await query(sql, values);
  } finally {
    release();
  }
}) as any;
pool.connect = (async () => {
  const release = await lock();
  return { query, release };
}) as any;
const admin = randomUUID(),
  location = randomUUID();
await db.query(
  "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,'Goshenignite Administrator','admin@example.com',$2,'admin')",
  [admin, await hashPassword('browser-test-password')],
);
await db.query(
  "INSERT INTO locations(id,name,description) VALUES($1,'Main clinic','Central supplies and equipment')",
  [location],
);
await db.query(
  "INSERT INTO suppliers(id,name,email) VALUES($1,'Example Supply Company','orders@example.com')",
  [randomUUID()],
);
for (const [sku, name, category, unit, min, cost, quantity] of [
  ['CLN-001', 'Nitrile gloves', 'Clinical supplies', 'box', 20, 12.5, 14],
  ['THR-001', 'Therapy journals', 'Therapy materials', 'each', 25, 4.8, 86],
  ['OFF-001', 'Printer paper', 'Office supplies', 'ream', 10, 6.5, 8],
  ['CLN-002', 'Surface disinfectant', 'Cleaning', 'bottle', 12, 8.95, 32],
] as const) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO items(id,sku,name,category,unit,reorder_point,unit_cost) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, sku, name, category, unit, min, cost],
  );
  await db.query('INSERT INTO stock(item_id,location_id,quantity) VALUES($1,$2,$3)', [
    id,
    location,
    quantity,
  ]);
}
const { app } = await import('../src/app.js');
const server = app.listen(3000, '127.0.0.1', () => console.log('Browser test API ready'));
process.on('SIGTERM', () => {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
});
