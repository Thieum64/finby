import { mkdtemp } from 'node:fs/promises';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, envConfig } from './index';

describe('svc-shops health endpoint', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'svc-shops-health-'));
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it('returns OK payload with project ID', async () => {
    const server = createServer({
      ...envConfig,
      GCP_PROJECT_ID: 'test-project',
      DATA_DIR: dataDir,
    });

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
  });
});
