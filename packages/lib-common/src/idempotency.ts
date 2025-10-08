import { createHash } from 'node:crypto';

export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._~-]{10,64}$/;

export function validateIdempotencyKey(key: string): boolean {
  return IDEMPOTENCY_KEY_REGEX.test(key);
}

export function idempotencyKeyHash(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}
