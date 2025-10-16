import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  ShopifyClient,
  calculateRetryDelay,
  createShopifyClient,
  getDefaultSecretNames,
  getSecretNameFromEnv,
  verifyShopifyHmac,
  verifyWebhookSignature,
} from './client';

describe('Shopify secrets helpers', () => {
  it('returns default secret names when env is unset', () => {
    expect(getDefaultSecretNames()).toEqual({
      apiKey: 'shopify-api-key',
      apiSecret: 'shopify-api-secret',
      webhookSecret: 'shopify-webhook-secret',
    });

    expect(getSecretNameFromEnv('apiKey', {})).toBe('shopify-api-key');
    expect(getSecretNameFromEnv('apiSecret', {})).toBe('shopify-api-secret');
    expect(getSecretNameFromEnv('webhookSecret', {})).toBe(
      'shopify-webhook-secret'
    );
  });

  it('prefers explicit environment overrides', () => {
    const env = {
      SHOPIFY_API_KEY_SECRET_NAME: 'projects/demo/secrets/api-key/versions/latest',
    };

    expect(getSecretNameFromEnv('apiKey', env)).toBe(
      'projects/demo/secrets/api-key/versions/latest'
    );
    expect(getSecretNameFromEnv('apiSecret', env)).toBe('shopify-api-secret');
  });
});

describe('ShopifyClient', () => {
  const baseConfig = {
    shopDomain: 'example.myshopify.com',
    accessToken: 'shpua_123',
  };

  it('performs a successful request using injected fetch implementation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ shop: { name: 'Demo Shop' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-shopify-shop-api-call-limit': '10/80',
        },
      })
    );

    const client = new ShopifyClient({ ...baseConfig, httpClient: fetchMock });
    const response = await client.request<{ shop: { name: string } }>({
      path: 'shop.json',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.hostname).toBe('example.myshopify.com');
    expect(url.pathname).toBe('/admin/api/2023-10/shop.json');
    expect(response.data.shop.name).toBe('Demo Shop');
    expect(response.rateLimit).toEqual({ used: 10, limit: 80, utilization: 0.125 });
  });

  it('retries automatically when encountering rate limits', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: 'Slow down' }), {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '1',
            'x-shopify-shop-api-call-limit': '80/80',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-shopify-shop-api-call-limit': '40/80',
          },
        })
      );

    const client = createShopifyClient({
      ...baseConfig,
      httpClient: fetchMock,
      initialRetryDelayMs: 200,
      maxRetries: 2,
    });

    const promise = client.request<{ ok: boolean }>({ path: 'check.json' });

    await vi.runOnlyPendingTimersAsync();
    const response = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.data.ok).toBe(true);

    vi.useRealTimers();
  });

  it('throws ShopifyError with parsed body when non-retryable error occurs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    );

    const client = new ShopifyClient({ ...baseConfig, httpClient: fetchMock });

    await expect(
      client.request({ path: 'admin-graphql.json', method: 'POST', body: {} })
    ).rejects.toMatchObject({
      name: 'ShopifyError',
      status: 403,
      body: { errors: 'Forbidden' },
    });
  });
});

describe('Retry delay helper', () => {
  it('uses retry-after header when provided', () => {
    const headers = new Headers({ 'retry-after': '3' });
    const delay = calculateRetryDelay(429, headers, 0, 500);
    expect(delay).toBe(3000);
  });

  it('falls back to exponential backoff', () => {
    const delay = calculateRetryDelay(500, new Headers(), 1, 250);
    expect(delay).toBe(1000);
  });
});

describe('HMAC verification utilities', () => {
  it('validates OAuth callback HMAC', () => {
    const params = {
      shop: 'demo.myshopify.com',
      timestamp: '1234567890',
    };

    const sharedSecret = 'shpss_123';
    const searchParams = new URLSearchParams(params);
    const hmac = crypto
      .createHmac('sha256', sharedSecret)
      .update(searchParams.toString(), 'utf8')
      .digest('hex');

    expect(verifyShopifyHmac({ ...params, hmac }, sharedSecret)).toBe(true);
    expect(verifyShopifyHmac({ ...params, hmac: 'invalid' }, sharedSecret)).toBe(false);
  });

  it('validates webhook signatures', () => {
    const secret = 'shpss_456';
    const payload = '{"event":"test"}';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(Buffer.from(payload))
      .digest('base64');

    expect(verifyWebhookSignature(payload, secret, signature)).toBe(true);
    expect(verifyWebhookSignature(payload, secret, 'wrong')).toBe(false);
  });
});
