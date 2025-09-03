import { createHash } from 'crypto';

/**
 * Generate idempotency key hash from request data
 */
export const generateIdempotencyHash = (
  method: string,
  path: string,
  body: any,
  headers: Record<string, string> = {}
): string => {
  const normalized = {
    method: method.toUpperCase(),
    path: path.toLowerCase(),
    body: body ? JSON.stringify(body) : '',
    // Include relevant headers for idempotency (e.g., tenant context)
    headers: Object.entries(headers)
      .filter(([key]) => ['x-tenant-id', 'x-shop-id'].includes(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
  };

  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
};

/**
 * Extract idempotency key from request headers
 */
export const extractIdempotencyKey = (headers: Record<string, string | undefined>): string | undefined => {
  return headers['x-idempotency-key'] || headers['idempotency-key'];
};

/**
 * Idempotency record for storage
 */
export interface IdempotencyRecord {
  key: string;
  hash: string;
  tenantId?: string;
  response?: {
    statusCode: number;
    body: any;
    headers: Record<string, string>;
  };
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Create idempotency record
 */
export const createIdempotencyRecord = (
  key: string,
  hash: string,
  tenantId?: string,
  ttlHours: number = 24
): IdempotencyRecord => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  return {
    key,
    hash,
    tenantId,
    createdAt: now,
    expiresAt,
  };
};

/**
 * Validate idempotency key format
 */
export const isValidIdempotencyKey = (key: string): boolean => {
  // Should be a string between 1 and 255 characters, alphanumeric + dashes/underscores
  return /^[a-zA-Z0-9_-]{1,255}$/.test(key);
};