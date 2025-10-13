import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ServiceConfig } from './config';
import { createServer } from './index';
import { calculateCallbackHmac } from './shopify/hmac';

describe('svc-shops integration', () => {
  const buildConfig = async (): Promise<{ config: ServiceConfig; dataDir: string }> => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'svc-shops-int-'));
    const config: ServiceConfig = {
      NODE_ENV: 'test',
      PORT: 0,
      LOG_LEVEL: 'error',
      GCP_PROJECT_ID: 'test-project',
      APP_URL: 'http://localhost:8080',
      SHOPIFY_API_KEY: 'test_key',
      SHOPIFY_API_SECRET: 'test_secret',
      SHOPIFY_WEBHOOK_SECRET: 'webhook_secret',
      SHOPIFY_SCOPES: 'read_products,write_products',
      STATE_TTL_SECONDS: 600,
      DATA_DIR: dataDir,
    };

    return { config, dataDir };
  };

  it('handles OAuth callback with valid signature and persists token', async () => {
    const { config, dataDir } = await buildConfig();
    const httpRequests: Array<{ input: string; body?: unknown }> = [];

    const httpClient = async (
      input: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string }
    ) => {
      httpRequests.push({ input, body: init?.body ? JSON.parse(init.body) : undefined });

      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: 'access-token', scope: 'read_products' };
        },
        async text() {
          return JSON.stringify({ access_token: 'access-token', scope: 'read_products' });
        },
      };
    };

    const server = createServer(config, { httpClient });

    const installResponse = await server.inject({
      method: 'GET',
      url: '/v1/shops/oauth/install',
      query: { shop: 'store.myshopify.com' },
    });

    expect(installResponse.statusCode).toBe(302);
    const location = installResponse.headers.location;
    expect(location).toBeDefined();

    const state = new URL(location as string).searchParams.get('state');
    expect(state).toBeTruthy();

    const params = new URLSearchParams({
      shop: 'store.myshopify.com',
      code: 'test-code',
      state: state as string,
      timestamp: '1700000000',
    });

    const hmac = calculateCallbackHmac(params, config.SHOPIFY_API_SECRET);
    params.set('hmac', hmac);

    const callbackResponse = await server.inject({
      method: 'GET',
      url: `/v1/shops/oauth/callback?${params.toString()}`,
    });

    expect(callbackResponse.statusCode).toBe(200);
    expect(callbackResponse.json()).toMatchObject({
      ok: true,
      shop: 'store.myshopify.com',
      scope: 'read_products',
    });

    expect(httpRequests).toHaveLength(1);
    expect(httpRequests[0]).toMatchObject({
      input: 'https://store.myshopify.com/admin/oauth/access_token',
      body: {
        client_id: 'test_key',
        client_secret: 'test_secret',
        code: 'test-code',
      },
    });

    const tokens = JSON.parse(
      await readFile(path.join(dataDir, 'shops.json'), 'utf8')
    ) as Array<{ shop: string; accessToken: string; scope: string }>;

    expect(tokens[0]).toMatchObject({
      shop: 'store.myshopify.com',
      accessToken: 'access-token',
      scope: 'read_products',
    });

    await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('validates webhook signature and ensures idempotence', async () => {
    const { config, dataDir } = await buildConfig();
    const server = createServer(config);

    const payload = { event: 'orders/create' };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const hmac = createHmac('sha256', config.SHOPIFY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('base64');

    const headers = {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-webhook-id': '1234',
      'x-shopify-topic': 'orders/create',
      'x-shopify-shop-domain': 'store.myshopify.com',
    };

    const first = await server.inject({
      method: 'POST',
      url: '/v1/shops/webhooks/shopify',
      headers,
      payload: JSON.stringify(payload),
    });

    expect(first.statusCode).toBe(200);

    const second = await server.inject({
      method: 'POST',
      url: '/v1/shops/webhooks/shopify',
      headers,
      payload: JSON.stringify(payload),
    });

    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ deduplicated: true });

    const invalid = await server.inject({
      method: 'POST',
      url: '/v1/shops/webhooks/shopify',
      headers: { ...headers, 'x-shopify-hmac-sha256': 'invalid' },
      payload: JSON.stringify(payload),
    });

    expect(invalid.statusCode).toBe(401);

    const storedIds = JSON.parse(
      await readFile(path.join(dataDir, 'webhooks.json'), 'utf8')
    ) as Array<{ id: string; receivedAt: string }>;
    expect(storedIds).toHaveLength(1);
    expect(storedIds[0].id).toBe('1234');

    await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });
});
