// One-time RDS setup. Run only as a short-lived administrator-controlled job.
import pg from 'pg';
import { readFileSync } from 'node:fs';
const appUrl = new URL(process.env.DATABASE_URL!);
const admin = JSON.parse(process.env.DB_ADMIN_JSON!);
const client = new pg.Client({
  host: appUrl.hostname,
  port: Number(appUrl.port || 5432),
  database: 'inventory',
  user: admin.username,
  password: admin.password,
  ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.DB_SSL_CA!, 'utf8') },
});
try {
  await client.connect();
  await client.query('BEGIN');
  const exists = (await client.query("SELECT 1 FROM pg_roles WHERE rolname='inventory_app'"))
    .rowCount;
  const sql = (
    await client.query(
      `SELECT format('${exists ? 'ALTER' : 'CREATE'} ROLE inventory_app LOGIN PASSWORD %L', $1::text) AS statement`,
      [decodeURIComponent(appUrl.password)],
    )
  ).rows[0].statement;
  await client.query(sql);
  await client.query('GRANT CONNECT ON DATABASE inventory TO inventory_app');
  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query('GRANT USAGE, CREATE ON SCHEMA public TO inventory_app');
  await client.query('COMMIT');
  console.log('Application database role provisioned');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Database provisioning failed');
  process.exitCode = 1;
} finally {
  await client.end();
}
