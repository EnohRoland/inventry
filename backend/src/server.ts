import { app } from './app.js';
import { pool } from './db.js';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN?.startsWith('https://'))
  throw new Error('Production APP_ORIGIN must use HTTPS');
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () =>
  console.log('Goshenignite API listening'),
);
const shutdown = () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
