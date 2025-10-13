import { describe, expect, it } from 'vitest';
import { createServer, envConfig } from './index';

describe('svc-shops health endpoint', () => {
  it('returns OK payload with project ID', async () => {
    const server = createServer({
      ...envConfig,
      GCP_PROJECT_ID: 'test-project',
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
  });
});
