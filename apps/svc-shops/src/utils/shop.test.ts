import { describe, expect, it } from 'vitest';
import { normalizeShopDomain } from './shop';

describe('normalizeShopDomain', () => {
  it('normalizes valid Shopify domains', () => {
    expect(normalizeShopDomain('Example-Shop.MyShopify.com')).toBe(
      'example-shop.myshopify.com'
    );
    expect(normalizeShopDomain('https://example.myshopify.com/admin')).toBe(
      'example.myshopify.com'
    );
  });

  it('rejects invalid domains', () => {
    expect(() => normalizeShopDomain('notshop.com')).toThrow(
      'Invalid Shopify shop domain'
    );
    expect(() => normalizeShopDomain('shopify.com')).toThrow();
    expect(() => normalizeShopDomain('')).toThrow();
  });
});
