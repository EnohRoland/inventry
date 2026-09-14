import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  nextQuantity,
  movementSchema,
  orderSchema,
} from '../src/domain.js';
test('passwords use independent salts and verify only the correct password', async () => {
  const password = 'a-long-example-password';
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('incorrect', a), false);
});
test('stock arithmetic rejects overdrafts, fractions, and database overflow', () => {
  assert.equal(nextQuantity(10, -10), 0);
  assert.equal(nextQuantity(0, 5), 5);
  for (const [a, b] of [
    [3, -4],
    [0, 0.5],
    [2147483647, 1],
  ])
    assert.throws(() => nextQuantity(a, b));
});
test('transfers require a different destination and positive whole quantities', () => {
  const input = {
    item_id: randomUUID(),
    location_id: randomUUID(),
    type: 'transfer',
    quantity: 3,
    reason: 'Weekly replenishment',
  };
  assert.equal(movementSchema.safeParse(input).success, false);
  assert.equal(
    movementSchema.safeParse({ ...input, destination_id: input.location_id }).success,
    false,
  );
  assert.equal(movementSchema.safeParse({ ...input, destination_id: randomUUID() }).success, true);
  assert.equal(movementSchema.safeParse({ ...input, type: 'issue', quantity: -1 }).success, false);
  assert.equal(movementSchema.safeParse({ ...input, type: 'adjust', quantity: -1 }).success, true);
  assert.equal(movementSchema.safeParse({ ...input, type: 'adjust', quantity: 0 }).success, false);
});
test('purchase orders reject duplicate item lines and empty orders', () => {
  const input = { supplier_id: randomUUID(), location_id: randomUUID(), lines: [] as any[] };
  assert.equal(orderSchema.safeParse(input).success, false);
  const line = { item_id: randomUUID(), quantity: 5, unit_cost: 1.25 };
  assert.equal(orderSchema.safeParse({ ...input, lines: [line, line] }).success, false);
  assert.equal(orderSchema.safeParse({ ...input, lines: [line] }).success, true);
});
