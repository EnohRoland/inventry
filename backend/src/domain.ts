import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
const scrypt = promisify(scryptCb);
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const idSchema = z.string().uuid();
export const roleSchema = z.enum(['admin', 'manager', 'staff', 'viewer']);
export const itemSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(30),
  reorder_point: z.number().int().min(0).max(1000000),
  unit_cost: z.number().min(0).max(1000000),
});
export const movementSchema = z
  .object({
    item_id: idSchema,
    location_id: idSchema,
    type: z.enum(['receive', 'issue', 'adjust', 'transfer']),
    quantity: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0, 'Quantity cannot be zero'),
    destination_id: idSchema.optional(),
    reason: z.string().trim().min(3).max(300),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'adjust' && v.quantity < 1)
      ctx.addIssue({ code: 'custom', message: 'Quantity must be positive', path: ['quantity'] });
    if (v.type === 'transfer' && (!v.destination_id || v.destination_id === v.location_id))
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a different destination',
        path: ['destination_id'],
      });
  });
export const orderSchema = z
  .object({
    supplier_id: idSchema,
    location_id: idSchema,
    lines: z
      .array(
        z.object({
          item_id: idSchema,
          quantity: z.number().int().min(1).max(1000000),
          unit_cost: z.number().min(0).max(1000000),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (v) => new Set(v.lines.map((l) => l.item_id)).size === v.lines.length,
    'An item may appear only once',
  );
export function nextQuantity(current: number, delta: number) {
  const result = current + delta;
  if (!Number.isSafeInteger(result) || result < 0 || result > 2147483647)
    throw new HttpError(409, 'Insufficient stock or stock limit exceeded');
  return result;
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
