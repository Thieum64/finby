import { createHmac } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as shopifyLib from '@hp/lib-shopify';
import { createServer } from '../index';
import { ServiceConfig } from '../config';

function buildConfig(dataDir: string): ServiceConfig {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    LOG_LEVEL: 'error',
    GCP_PROJECT_ID: 'test-project',
    GOOGLE_CLOUD_PROJECT: undefined,
    APP_URL: 'http://localhost:8080/v1/shops',
    SHOPIFY_API_KEY: 'dev_key',
    SHOPIFY_API_SECRET: 'dev_secret',
    SHOPIFY_SCOPES: 'read_themes,write_themes',
    SHOPIFY_WEBHOOK_SECRET: 'dev_webhook_secret',
    STATE_TTL_SECONDS: 600,
    DATA_DIR: dataDir,
  };
}

function buildCallbackHmac(
  params: Record<string, string>,
  secret: string
): string {
  const pairs = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  return createHmac('sha256', secret).update(pairs.join('&')).digest('hex');
}

describe('Shop routes integration', () => {
  let dataDir: string;
  let config: ServiceConfig;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'svc-shops-data-'));
    config = buildConfig(dataDir);
    server = createServer(config);
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(dataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('redirects to Shopify authorize URL with state', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/shops/install',
      query: {
        shop: 'test-shop.myshopify.com',
      },
    });

    expect(response.statusCode).toBe(302);
    const location = response.headers.location;
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location as string);
    expect(redirectUrl.hostname).toBe('test-shop.myshopify.com');
    expect(redirectUrl.searchParams.get('client_id')).toBe(
      config.SHOPIFY_API_KEY
    );
    expect(redirectUrl.searchParams.get('scope')).toBe(config.SHOPIFY_SCOPES);
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
      `${config.APP_URL}/callback`.replace('//callback', '/callback')
    );
    expect(redirectUrl.searchParams.get('state')).toBeTruthy();
  });

  it('completes callback flow and persists token', async () => {
    const installResponse = await server.inject({
      method: 'GET',
      url: '/v1/shops/install',
      query: { shop: 'test-shop.myshopify.com' },
    });
    const redirectUrl = new URL(installResponse.headers.location as string);
    const state = redirectUrl.searchParams.get('state') as string;

    vi.spyOn(shopifyLib, 'exchangeCodeForToken').mockResolvedValue({
      access_token: 'shpat_mock',
      scope: 'read_themes,write_themes',
    });

    const params = {
      code: 'auth-code',
      shop: 'test-shop.myshopify.com',
      state,
      timestamp: '1697040000',
    };
    const hmac = buildCallbackHmac(params, config.SHOPIFY_API_SECRET);

    const response = await server.inject({
      method: 'GET',
      url: '/v1/shops/callback',
      query: {
        ...params,
        hmac,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      installed: true,
      shop: 'test-shop.myshopify.com',
    });

    const stored = JSON.parse(
      await fs.readFile(join(dataDir, 'shops.json'), 'utf8')
    );
    expect(stored.data[0]).toMatchObject({
      shop: 'test-shop.myshopify.com',
      access_token: 'shpat_mock',
    });
  });

  it('rejects callback when state missing or expired', async () => {
    const params = {
      code: 'auth',
      shop: 'test-shop.myshopify.com',
      state: 'missing',
      timestamp: '1697040000',
    };
    const hmac = buildCallbackHmac(params, config.SHOPIFY_API_SECRET);

    const response = await server.inject({
      method: 'GET',
      url: '/v1/shops/callback',
      query: { ...params, hmac },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid_state' });
  });

  it('rejects callback with invalid HMAC', async () => {
    const installResponse = await server.inject({
      method: 'GET',
      url: '/v1/shops/install',
      query: { shop: 'test-shop.myshopify.com' },
    });
    const redirectUrl = new URL(installResponse.headers.location as string);
    const state = redirectUrl.searchParams.get('state') as string;

    const response = await server.inject({
      method: 'GET',
      url: '/v1/shops/callback',
      query: {
        code: 'auth-code',
        shop: 'test-shop.myshopify.com',
        state,
        timestamp: '1697040000',
        hmac: 'bad',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid_hmac' });
  });

  it('validates webhook signatures and enforces idempotence', async () => {
    const payload = JSON.stringify({ id: 1 });
    const signature = createHmac('sha256', config.SHOPIFY_WEBHOOK_SECRET)
      .update(payload)
      .digest('base64');

    const headers = {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': signature,
      'x-shopify-webhook-id': 'webhook-1',
      'x-shopify-topic': 'app/uninstalled',
      'x-shopify-shop-domain': 'test-shop.myshopify.com',
    };

    const first = await server.inject({
      method: 'POST',
      url: '/v1/shops/webhooks/shopify',
      headers,
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ ok: true, replay: false });

    const replay = await server.inject({
      method: 'POST',
      url: '/v1/shops/webhooks/shopify',
      headers,
      payload,
    });

    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ ok: true, replay: true });
  });

  it('rejects webhook with invalid signature', async () => {
    const payload = JSON.stringify({ id: 1 });

    const response = await server.inject({
      method: 'POST',
      url: '/v1/shops/webhooks/shopify',
      headers: {
        'content-type': 'application/json',
        'x-shopify-hmac-sha256': 'invalid',
        'x-shopify-webhook-id': 'webhook-2',
      },
      payload,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid_hmac' });
  });
});
