import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { hashPassword } from '../src/domain.js';

process.env.APP_ORIGIN = 'http://localhost:8080';
process.env.NODE_ENV = 'test';
const schema = `test_${randomUUID().replaceAll('-', '')}`;
if (process.env.DATABASE_URL) process.env.PGOPTIONS = `-c search_path=${schema},public`;
const { pool } = await import('../src/db.js');
let embedded: PGlite | undefined;
if (!process.env.DATABASE_URL) {
  embedded = new PGlite();
  let tail = Promise.resolve();
  async function lock() {
    const before = tail;
    let release!: () => void;
    tail = new Promise<void>((r) => {
      release = r;
    });
    await before;
    return release;
  }
  const query = async (sql: string, values?: unknown[]) => {
    const r = values ? await embedded!.query(sql, values) : (await embedded!.exec(sql)).at(-1)!;
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
}
const { app } = await import('../src/app.js');
const origin = 'http://localhost:8080';
const password = 'integration-test-password';
test('inventory API integration against PostgreSQL', async (t) => {
  if (!embedded) {
    await pool.query(`CREATE SCHEMA ${schema}`);
  }
  try {
    const { migrate } = await import('../src/migrate.js');
    await migrate();
    await migrate();
    assert.equal((await pool.query('SELECT * FROM schema_migrations')).rows.length, 1);
    assert.equal((await request(app).get('/api/health/ready')).status, 200);
    const hash = await hashPassword(password);
    const people = {
      admin: randomUUID(),
      manager: randomUUID(),
      staff: randomUUID(),
      viewer: randomUUID(),
    };
    for (const [role, id] of Object.entries(people))
      await pool.query(
        'INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',
        [id, role, `${role}@example.com`, hash, role],
      );
    const agents = Object.fromEntries(
      Object.keys(people).map((role) => [role, request.agent(app)]),
    );
    for (const [role, agent] of Object.entries(agents)) {
      const r = await agent
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: `${role}@example.com`, password });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.match(r.headers['set-cookie'][0], /HttpOnly/);
      assert.match(r.headers['set-cookie'][0], /SameSite=Strict/);
    }
    const admin = agents.admin,
      staff = agents.staff,
      viewer = agents.viewer;
    let item: string, source: string, destination: string, supplier: string, order: string;
    const stock = async () => (await admin.get('/api/items')).body.find((i: any) => i.id === item);
    await t.test('authentication, CSRF protection, and role boundaries', async () => {
      assert.equal((await request(app).get('/api/items')).status, 401);
      assert.equal((await admin.post('/api/items').send({})).status, 403);
      assert.equal((await viewer.post('/api/items').set('Origin', origin).send({})).status, 403);
      assert.equal((await staff.get('/api/users')).status, 403);
      assert.equal((await viewer.get('/api/audit')).status, 403);
      assert.equal(
        (
          await request(app)
            .post('/api/auth/login')
            .set('Origin', origin)
            .send({ email: 'admin@example.com', password: 'wrong' })
        ).status,
        401,
      );
    });
    await t.test('create catalog and reject duplicate SKUs', async () => {
      const body = {
        sku: 'TEST-001',
        name: 'Therapy journal',
        category: 'Therapy',
        unit: 'each',
        reorder_point: 5,
        unit_cost: 2.5,
      };
      const r = await admin.post('/api/items').set('Origin', origin).send(body);
      assert.equal(r.status, 201);
      item = r.body.id;
      assert.equal((await admin.post('/api/items').set('Origin', origin).send(body)).status, 409);
      const a = await admin
        .post('/api/locations')
        .set('Origin', origin)
        .send({ name: 'Main clinic' });
      assert.equal(a.status, 201);
      source = a.body.id;
      const b = await admin.post('/api/locations').set('Origin', origin).send({ name: 'Outreach' });
      assert.equal(b.status, 201);
      destination = b.body.id;
      const s = await admin.post('/api/suppliers').set('Origin', origin).send({ name: 'Supplier' });
      assert.equal(s.status, 201);
      supplier = s.body.id;
    });
    await t.test(
      'receive, issue, adjust and transfer with an atomic overdraft rejection',
      async () => {
        const move = (type: string, quantity: number, extra = {}) =>
          staff
            .post('/api/movements')
            .set('Origin', origin)
            .send({
              item_id: item,
              location_id: source,
              type,
              quantity,
              reason: 'Test operations',
              ...extra,
            });
        assert.equal((await move('receive', 20)).status, 201);
        assert.equal((await move('issue', 5)).status, 201);
        assert.equal((await move('transfer', 7, { destination_id: destination })).status, 201);
        assert.equal((await stock()).quantity, 15);
        assert.equal((await move('transfer', 9, { destination_id: destination })).status, 409);
        assert.equal((await stock()).quantity, 15);
        assert.equal((await move('adjust', -1)).status, 403);
        assert.equal((await move('transfer', 1, { destination_id: source })).status, 400);
        const r = await admin.post('/api/movements').set('Origin', origin).send({
          item_id: item,
          location_id: source,
          type: 'adjust',
          quantity: -1,
          reason: 'Count correction',
        });
        assert.equal(r.status, 201);
        assert.equal((await stock()).quantity, 14);
      },
    );
    await t.test('concurrent stock issues cannot overdraw', async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          staff.post('/api/movements').set('Origin', origin).send({
            item_id: item,
            location_id: source,
            type: 'issue',
            quantity: 5,
            reason: 'Concurrent requests',
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      assert.equal((await stock()).quantity, 9);
    });
    await t.test('purchase order state machine and repeated receiving', async () => {
      const r = await admin
        .post('/api/orders')
        .set('Origin', origin)
        .send({
          supplier_id: supplier,
          location_id: source,
          lines: [{ item_id: item, quantity: 12, unit_cost: 2.25 }],
        });
      assert.equal(r.status, 201);
      order = r.body.id;
      assert.equal(
        (await admin.post(`/api/orders/${order}/receive`).set('Origin', origin)).status,
        409,
      );
      assert.equal(
        (await admin.post(`/api/orders/${order}/submit`).set('Origin', origin)).status,
        204,
      );
      const receipts = await Promise.all(
        [1, 2].map(() => admin.post(`/api/orders/${order}/receive`).set('Origin', origin)),
      );
      assert.deepEqual(
        receipts.map((r) => r.status),
        [204, 204],
      );
      assert.equal((await stock()).quantity, 21);
      assert.equal(
        (await admin.post(`/api/orders/${order}/cancel`).set('Origin', origin)).status,
        409,
      );
      const orders = await admin.get('/api/orders');
      assert.equal(orders.body[0].status, 'received');
      assert.equal(Number(orders.body[0].total), 27);
    });
    await t.test(
      'database rollback preserves source stock when destination is invalid',
      async () => {
        const r = await admin.post('/api/movements').set('Origin', origin).send({
          item_id: item,
          location_id: source,
          destination_id: randomUUID(),
          type: 'transfer',
          quantity: 1,
          reason: 'Invalid destination',
        });
        assert.equal(r.status, 400);
        assert.equal((await stock()).quantity, 21);
      },
    );
    await t.test('audit events exist and never expose password hashes', async () => {
      const r = await admin.get('/api/audit');
      assert.equal(r.status, 200);
      assert.ok(r.body.some((a: any) => a.action === 'order.receive'));
      assert.ok(r.body.some((a: any) => a.action === 'stock.transfer'));
      assert.ok(!JSON.stringify(r.body).includes(hash));
      assert.ok(!(await admin.get('/api/users')).body.some((u: any) => u.password_hash));
    });
    await t.test(
      'deactivation revokes existing sessions and self-deactivation is blocked',
      async () => {
        assert.equal(
          (
            await admin
              .patch(`/api/users/${people.admin}`)
              .set('Origin', origin)
              .send({ active: false, role: 'admin' })
          ).status,
          400,
        );
        assert.equal(
          (
            await admin
              .patch(`/api/users/${people.staff}`)
              .set('Origin', origin)
              .send({ active: false, role: 'staff' })
          ).status,
          204,
        );
        assert.equal((await staff.get('/api/items')).status, 401);
      },
    );
    await t.test('password changes and logout revoke sessions', async () => {
      assert.equal(
        (
          await viewer
            .post('/api/auth/password')
            .set('Origin', origin)
            .send({ current: password, password: 'changed-integration-password' })
        ).status,
        204,
      );
      assert.equal((await viewer.get('/api/items')).status, 401);
      assert.equal((await admin.post('/api/auth/logout').set('Origin', origin)).status, 204);
      assert.equal((await admin.get('/api/items')).status, 401);
    });
  } finally {
    if (embedded) await embedded.close();
    else await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
});
