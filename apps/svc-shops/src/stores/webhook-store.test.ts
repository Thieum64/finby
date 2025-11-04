import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { WebhookStore } from './webhook-store';

describe('WebhookStore', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'webhook-store-'));
    filePath = join(dir, 'webhooks.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('tracks idempotent webhook deliveries', async () => {
    const store = new WebhookStore({ filePath, maxEntries: 10 });

    const first = await store.markHandled('id-1', {
      shop: 'shop',
      topic: 'orders/create',
    });
    expect(first).toBe(true);

    const replay = await store.markHandled('id-1', {
      shop: 'shop',
      topic: 'orders/create',
    });
    expect(replay).toBe(false);

    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    expect(data.version).toBe(1);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
