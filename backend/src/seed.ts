import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { hashPassword } from './domain.js';
import { audit, changeStock } from './stock.js';
const email = z.email().parse(process.env.SEED_ADMIN_EMAIL).toLowerCase();
const password = z.string().min(14).max(200).parse(process.env.SEED_ADMIN_PASSWORD);
try {
  const hash = await hashPassword(password);
  await transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(742194)');
    if ((await c.query('SELECT 1 FROM users LIMIT 1')).rowCount) {
      console.log('Database already initialized; seed skipped');
      return;
    }
    const admin = randomUUID();
    await c.query(
      "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,'Goshenignite Administrator',$2,$3,'admin')",
      [admin, email, hash],
    );
    await audit(c, admin, 'system.initialized', admin);
    if (process.env.SEED_DEMO !== 'true') return;
    if (process.env.NODE_ENV === 'production')
      throw new Error('Demo data is not allowed in production');
    const locations = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, name] of ['Main clinic', 'Therapy rooms', 'Community outreach'].entries())
      await c.query('INSERT INTO locations(id,name,description) VALUES($1,$2,$3)', [
        locations[i],
        name,
        'Sample location — update for your business',
      ]);
    await c.query(
      "INSERT INTO suppliers(id,name,email) VALUES($1,'Example Supply Company','orders@example.com')",
      [randomUUID()],
    );
    const samples: [string, string, string, string, number, number, number][] = [
      ['CLN-001', 'Nitrile gloves', 'Clinical supplies', 'box', 20, 12.5, 14],
      ['THR-001', 'Therapy journals', 'Therapy materials', 'each', 25, 4.8, 86],
      ['CLN-002', 'Surface disinfectant', 'Cleaning', 'bottle', 12, 8.95, 32],
      ['OFF-001', 'Printer paper', 'Office supplies', 'ream', 10, 6.5, 8],
      ['THR-002', 'Sensory calming kit', 'Therapy materials', 'kit', 8, 24, 18],
      ['EQP-001', 'Digital thermometer', 'Equipment', 'each', 3, 32, 6],
      ['OUT-001', 'Wellness resource pack', 'Outreach', 'pack', 30, 3.2, 12],
      ['CLN-003', 'Hand sanitizer', 'Clinical supplies', 'bottle', 15, 5.75, 45],
    ];
    for (const [i, s] of samples.entries()) {
      const id = randomUUID();
      await c.query(
        'INSERT INTO items(id,sku,name,category,unit,reorder_point,unit_cost) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [id, ...s.slice(0, 6)],
      );
      await changeStock(
        c,
        id,
        locations[i % 3],
        s[6],
        'receive',
        'Initial demonstration stock',
        admin,
      );
    }
  });
  console.log('Initialization complete');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
