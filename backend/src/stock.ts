import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { nextQuantity } from './domain.js';
export async function audit(
  client: pg.PoolClient,
  actor: string | null,
  action: string,
  entity: string,
  details = {},
) {
  await client.query(
    'INSERT INTO audit_events(id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), actor, action, entity, JSON.stringify(details)],
  );
}
export async function changeStock(
  client: pg.PoolClient,
  item: string,
  location: string,
  delta: number,
  type: string,
  reason: string,
  actor: string,
  order: string | null = null,
) {
  await client.query(
    'INSERT INTO stock(item_id,location_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [item, location],
  );
  const { rows } = await client.query(
    'SELECT quantity FROM stock WHERE item_id=$1 AND location_id=$2 FOR UPDATE',
    [item, location],
  );
  const quantity = nextQuantity(rows[0].quantity, delta);
  await client.query('UPDATE stock SET quantity=$3 WHERE item_id=$1 AND location_id=$2', [
    item,
    location,
    quantity,
  ]);
  const id = randomUUID();
  await client.query(
    'INSERT INTO movements(id,item_id,location_id,type,quantity,reason,actor_id,order_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, item, location, type, delta, reason, actor, order],
  );
  return id;
}
