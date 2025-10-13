import { describe, expect, it } from 'vitest';
import {
  getDefaultSecretNames,
  getSecretNameFromEnv,
  getSecretValueLazy,
} from './client';

describe('lib-shopify secret helpers', () => {
  it('returns defaults when env missing', () => {
    expect(getSecretNameFromEnv('apiKey', {})).toBe('shopify/api-key');
    expect(getSecretNameFromEnv('apiSecret', {})).toBe('shopify/api-secret');
    expect(getSecretNameFromEnv('webhookSecret', {})).toBe('shopify/webhook-secret');
  });

  it('returns overrides when provided', () => {
    const env = {
      SHOPIFY_API_KEY_SECRET_NAME: 'override/api-key',
      SHOPIFY_API_SECRET_SECRET_NAME: 'override/api-secret',
      SHOPIFY_WEBHOOK_SECRET_SECRET_NAME: 'override/webhook-secret',
    };

    expect(getSecretNameFromEnv('apiKey', env)).toBe('override/api-key');
    expect(getSecretNameFromEnv('apiSecret', env)).toBe('override/api-secret');
    expect(getSecretNameFromEnv('webhookSecret', env)).toBe('override/webhook-secret');
  });

  it('lazy secret resolution is deferred', async () => {
    const lazy = getSecretValueLazy('shopify/api-key');
    await expect(lazy.resolve()).rejects.toThrow(/TODO\(phase-2.4\)/i);
  });

  it('provides immutable defaults snapshot', () => {
    const defaults = getDefaultSecretNames();
    expect(defaults).toEqual({
      apiKey: 'shopify/api-key',
      apiSecret: 'shopify/api-secret',
      webhookSecret: 'shopify/webhook-secret',
    });
  });
});
