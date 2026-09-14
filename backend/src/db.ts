import pg from 'pg';
import { readFileSync } from 'node:fs';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  ...(process.env.DB_SSL_CA
    ? { ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DB_SSL_CA, 'utf8') } }
    : {}),
});
pool.on('error', (err) => console.error('Unexpected database connection error', err.message));
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
