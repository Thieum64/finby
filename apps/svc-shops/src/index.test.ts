import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ServiceConfig } from './config';
import { createServer } from './index';

describe('svc-shops health endpoint', () => {
  it('returns OK payload with project ID', async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), 'svc-shops-test-'));
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

    const server = createServer(config);

    const response = await server.inject({
      method: 'GET',
      url: '/v1/shops/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      ok: true,
      service: 'svc-shops',
      projectId: 'test-project',
    });

    await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });
});
