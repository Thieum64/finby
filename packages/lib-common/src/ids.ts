import { ulid } from 'ulid';

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function newUlid(): string {
  return ulid();
}

export function isUlid(str: string): boolean {
  return ULID_REGEX.test(str);
}

export type TenantId = string & { readonly __brand: 'TenantId' };

export function asTenantId(str: string): TenantId {
  if (!isUlid(str)) {
    throw new Error(`Invalid tenant ID: ${str}`);
  }
  return str as TenantId;
}
