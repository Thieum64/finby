import { ulid } from 'ulid';

/**
 * Generate a new ULID
 */
export const generateId = (): string => ulid();

/**
 * Generate a request ID
 */
export const generateRequestId = (): string => `req_${ulid()}`;

/**
 * Generate a job ID
 */
export const generateJobId = (): string => `job_${ulid()}`;

/**
 * Generate a tenant ID
 */
export const generateTenantId = (): string => `ten_${ulid()}`;

/**
 * Generate a shop ID
 */
export const generateShopId = (): string => `shop_${ulid()}`;

/**
 * Validate if a string is a valid ULID
 */
export const isValidUlid = (id: string): boolean => {
  const ulidPattern = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
  return ulidPattern.test(id);
};

/**
 * Extract timestamp from ULID
 */
export const getTimestampFromUlid = (id: string): Date => {
  if (!isValidUlid(id)) {
    throw new Error('Invalid ULID format');
  }
  
  const time = ulid(Date.now());
  // Extract the first 10 characters which represent the timestamp
  const timestamp = parseInt(id.substring(0, 10), 32);
  return new Date(timestamp);
};