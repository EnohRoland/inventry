import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { pool, transaction } from './db.js';
import {
  HttpError,
  hashPassword,
  verifyPassword,
  tokenHash,
  idSchema,
  itemSchema,
  movementSchema,
  orderSchema,
  roleSchema,
} from './domain.js';
import { audit, changeStock } from './stock.js';

type User = { id: string; name: string; email: string; role: string };
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', randomUUID());
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin !== (process.env.APP_ORIGIN || 'http://localhost:8080')
  )
    return next(new HttpError(403, 'Untrusted request origin'));
  next();
});
app.get('/api/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health/ready', async (_req, res) => {
  await pool.query('SELECT 1 FROM schema_migrations LIMIT 1');
  res.json({ status: 'ready' });
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api',
};
const sessionToken = (req: Request) =>
  req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('session='))
    ?.slice(8);
const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const input = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(200) })
    .parse(req.body);
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND active=true', [
    input.email.toLowerCase(),
  ]);
  const valid = await verifyPassword(input.password, rows[0]?.password_hash || dummyHash);
  if (!rows[0] || !valid) throw new HttpError(401, 'Invalid email or password');
  const token = randomBytes(32).toString('hex');
  await transaction(async (client) => {
    await client.query('DELETE FROM sessions WHERE expires_at < now() OR token_hash=$1', [
      tokenHash(sessionToken(req) || ''),
    ]);
    await client.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [tokenHash(token), rows[0].id],
    );
    await audit(client, rows[0].id, 'auth.login', rows[0].id);
  });
  res.cookie('session', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  const { id, name, email, role } = rows[0];
  res.json({ id, name, email, role });
});
app.use('/api', async (req, _res, next) => {
  const token = sessionToken(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, 'Please sign in');
  const { rows } = await pool.query(
    'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',
    [tokenHash(token)],
  );
  if (!rows[0]) throw new HttpError(401, 'Session expired. Please sign in');
  req.user = rows[0];
  next();
});
const roles =
  (...allowed: string[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    allowed.includes(req.user!.role)
      ? next()
      : next(new HttpError(403, 'Your role cannot perform this action'));
const manage = roles('admin', 'manager');
app.get('/api/auth/me', (req, res) => res.json(req.user));
app.post('/api/auth/logout', async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(sessionToken(req)!)]);
  res.clearCookie('session', cookieOptions);
  res.status(204).end();
});
app.post('/api/auth/password', async (req, res) => {
  const input = z
    .object({ current: z.string().min(1).max(200), password: z.string().min(14).max(200) })
    .parse(req.body);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
  if (!(await verifyPassword(input.current, rows[0].password_hash)))
    throw new HttpError(400, 'Current password is incorrect');
  const hash = await hashPassword(input.password);
  await transaction(async (c) => {
    await c.query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.user!.id, hash]);
    await c.query('DELETE FROM sessions WHERE user_id=$1', [req.user!.id]);
    await audit(c, req.user!.id, 'user.password_changed', req.user!.id);
  });
  res.clearCookie('session', cookieOptions);
  res.status(204).end();
});
app.get('/api/items', async (_req, res) => {
  const { rows } = await pool.query(`SELECT i.*, COALESCE(sum(s.quantity),0)::int AS quantity,
    COALESCE(jsonb_agg(jsonb_build_object('location_id',l.id,'location',l.name,'quantity',s.quantity)) FILTER(WHERE l.id IS NOT NULL),'[]') AS stock
    FROM items i LEFT JOIN stock s ON s.item_id=i.id LEFT JOIN locations l ON l.id=s.location_id GROUP BY i.id ORDER BY i.name`);
  res.json(rows);
});
app.post('/api/items', manage, async (req, res) => {
  const v = itemSchema.parse(req.body),
    id = randomUUID();
  await transaction(async (c) => {
    await c.query(
      'INSERT INTO items(id,sku,name,category,unit,reorder_point,unit_cost) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, v.sku.toUpperCase(), v.name, v.category, v.unit, v.reorder_point, v.unit_cost],
    );
    await audit(c, req.user!.id, 'item.created', id, v);
  });
  res.status(201).json({ id });
});
app.put('/api/items/:id', manage, async (req, res) => {
  const id = idSchema.parse(req.params.id),
    v = itemSchema.parse(req.body);
  await transaction(async (c) => {
    const r = await c.query(
      'UPDATE items SET sku=$2,name=$3,category=$4,unit=$5,reorder_point=$6,unit_cost=$7 WHERE id=$1',
      [id, v.sku.toUpperCase(), v.name, v.category, v.unit, v.reorder_point, v.unit_cost],
    );
    if (!r.rowCount) throw new HttpError(404, 'Item not found');
    await audit(c, req.user!.id, 'item.updated', id, v);
  });
  res.status(204).end();
});
app.get('/api/locations', async (_req, res) =>
  res.json((await pool.query('SELECT * FROM locations ORDER BY name')).rows),
);
app.post('/api/locations', manage, async (req, res) => {
  const v = z
      .object({
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().max(250).default(''),
      })
      .parse(req.body),
    id = randomUUID();
  await transaction(async (c) => {
    await c.query('INSERT INTO locations(id,name,description) VALUES($1,$2,$3)', [
      id,
      v.name,
      v.description,
    ]);
    await audit(c, req.user!.id, 'location.created', id, v);
  });
  res.status(201).json({ id });
});
app.get('/api/suppliers', async (_req, res) =>
  res.json((await pool.query('SELECT * FROM suppliers ORDER BY name')).rows),
);
app.post('/api/suppliers', manage, async (req, res) => {
  const v = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.union([z.email().max(254), z.literal('')]).default(''),
        phone: z.string().trim().max(40).default(''),
      })
      .parse(req.body),
    id = randomUUID();
  await transaction(async (c) => {
    await c.query('INSERT INTO suppliers(id,name,email,phone) VALUES($1,$2,$3,$4)', [
      id,
      v.name,
      v.email,
      v.phone,
    ]);
    await audit(c, req.user!.id, 'supplier.created', id, v);
  });
  res.status(201).json({ id });
});
app.get('/api/movements', async (_req, res) =>
  res.json(
    (
      await pool.query(
        'SELECT m.*,i.name AS item,i.sku,l.name AS location,u.name AS actor FROM movements m JOIN items i ON i.id=m.item_id JOIN locations l ON l.id=m.location_id JOIN users u ON u.id=m.actor_id ORDER BY m.created_at DESC,m.id LIMIT 200',
      )
    ).rows,
  ),
);
app.post('/api/movements', roles('admin', 'manager', 'staff'), async (req, res) => {
  const v = movementSchema.parse(req.body);
  if (v.type === 'adjust' && req.user!.role === 'staff')
    throw new HttpError(403, 'Adjustments require a manager');
  await transaction(async (c) => {
    // Serialize movements per item, including opposite-direction transfers.
    if (!(await c.query('SELECT id FROM items WHERE id=$1 FOR UPDATE', [v.item_id])).rowCount)
      throw new HttpError(404, 'Item not found');
    await changeStock(
      c,
      v.item_id,
      v.location_id,
      ['issue', 'transfer'].includes(v.type) ? -v.quantity : v.quantity,
      v.type === 'transfer' ? 'transfer_out' : v.type,
      v.reason,
      req.user!.id,
    );
    if (v.type === 'transfer')
      await changeStock(
        c,
        v.item_id,
        v.destination_id!,
        v.quantity,
        'transfer_in',
        v.reason,
        req.user!.id,
      );
    await audit(c, req.user!.id, `stock.${v.type}`, v.item_id, v);
  });
  res.status(201).json({ success: true });
});
app.get('/api/orders', async (_req, res) =>
  res.json(
    (
      await pool.query(`SELECT p.*,s.name AS supplier,l.name AS location,
  COALESCE((SELECT sum(pl.quantity*pl.unit_cost) FROM purchase_order_lines pl WHERE pl.order_id=p.id),0) AS total,
  (SELECT jsonb_agg(jsonb_build_object('item_id',pl.item_id,'item',i.name,'quantity',pl.quantity,'unit_cost',pl.unit_cost)) FROM purchase_order_lines pl JOIN items i ON i.id=pl.item_id WHERE pl.order_id=p.id) AS lines
  FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id JOIN locations l ON l.id=p.location_id ORDER BY p.created_at DESC LIMIT 200`)
    ).rows,
  ),
);
app.post('/api/orders', manage, async (req, res) => {
  const v = orderSchema.parse(req.body),
    id = randomUUID();
  await transaction(async (c) => {
    await c.query(
      'INSERT INTO purchase_orders(id,supplier_id,location_id,created_by) VALUES($1,$2,$3,$4)',
      [id, v.supplier_id, v.location_id, req.user!.id],
    );
    for (const line of v.lines)
      await c.query(
        'INSERT INTO purchase_order_lines(order_id,item_id,quantity,unit_cost) VALUES($1,$2,$3,$4)',
        [id, line.item_id, line.quantity, line.unit_cost],
      );
    await audit(c, req.user!.id, 'order.created', id, v);
  });
  res.status(201).json({ id });
});
app.post('/api/orders/:id/:action', manage, async (req, res) => {
  const id = idSchema.parse(req.params.id),
    action = z.enum(['submit', 'receive', 'cancel']).parse(req.params.action);
  await transaction(async (c) => {
    const order = (await c.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE', [id]))
      .rows[0];
    if (!order) throw new HttpError(404, 'Order not found');
    if (action === 'receive' && order.status === 'received') return; // Retry-safe receipt.
    if (
      (action === 'submit' && order.status !== 'draft') ||
      (action === 'receive' && order.status !== 'ordered') ||
      (action === 'cancel' && !['draft', 'ordered'].includes(order.status))
    )
      throw new HttpError(409, 'Invalid order status transition');
    if (action === 'receive') {
      const lines = (
        await c.query('SELECT * FROM purchase_order_lines WHERE order_id=$1 ORDER BY item_id', [id])
      ).rows;
      for (const line of lines) {
        await c.query('SELECT id FROM items WHERE id=$1 FOR UPDATE', [line.item_id]);
        await changeStock(
          c,
          line.item_id,
          order.location_id,
          line.quantity,
          'receive',
          `Purchase order PO-${order.number}`,
          req.user!.id,
          id,
        );
      }
    }
    const status = { submit: 'ordered', receive: 'received', cancel: 'cancelled' }[action];
    await c.query(
      "UPDATE purchase_orders SET status=$2,received_at=CASE WHEN $2='received' THEN now() ELSE NULL END WHERE id=$1",
      [id, status],
    );
    await audit(c, req.user!.id, `order.${action}`, id);
  });
  res.status(204).end();
});
app.get('/api/audit', manage, async (_req, res) =>
  res.json(
    (
      await pool.query(
        'SELECT a.*,u.name AS actor FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC,a.id LIMIT 200',
      )
    ).rows,
  ),
);
app.get('/api/users', roles('admin'), async (_req, res) =>
  res.json(
    (await pool.query('SELECT id,name,email,role,active,created_at FROM users ORDER BY name')).rows,
  ),
);
app.post('/api/users', roles('admin'), async (req, res) => {
  const v = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email().max(254),
        role: roleSchema,
        password: z.string().min(14).max(200),
      })
      .parse(req.body),
    id = randomUUID(),
    hash = await hashPassword(v.password);
  await transaction(async (c) => {
    await c.query('INSERT INTO users(id,name,email,role,password_hash) VALUES($1,$2,$3,$4,$5)', [
      id,
      v.name,
      v.email.toLowerCase(),
      v.role,
      hash,
    ]);
    await audit(c, req.user!.id, 'user.created', id, { email: v.email, role: v.role });
  });
  res.status(201).json({ id });
});
app.patch('/api/users/:id', roles('admin'), async (req, res) => {
  const id = idSchema.parse(req.params.id),
    v = z.object({ active: z.boolean(), role: roleSchema }).parse(req.body);
  if (id === req.user!.id)
    throw new HttpError(400, 'You cannot change your own role or deactivate yourself');
  await transaction(async (c) => {
    if (
      !(await c.query('UPDATE users SET role=$2,active=$3 WHERE id=$1', [id, v.role, v.active]))
        .rowCount
    )
      throw new HttpError(404, 'User not found');
    await c.query('DELETE FROM sessions WHERE user_id=$1', [id]);
    await audit(c, req.user!.id, 'user.updated', id, v);
  });
  res.status(204).end();
});
app.use((_req, _res, next) => next(new HttpError(404, 'Route not found')));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'That record already exists' });
  if (err.code === '23503')
    return res.status(400).json({ error: 'Referenced record does not exist' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request is too large' });
  console.error(
    JSON.stringify({ event: 'request_error', code: err.code || 'internal', message: err.message }),
  );
  return res.status(500).json({ error: 'An unexpected error occurred' });
});
