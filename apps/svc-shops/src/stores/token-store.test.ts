import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { FileTokenStore, TokenRecord } from './token-store';

describe('FileTokenStore', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'token-store-'));
    filePath = join(dir, 'shops.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('persists and retrieves tokens per shop', async () => {
    const record: TokenRecord = {
      shop: 'test-shop.myshopify.com',
      access_token: 'shpat_test',
      scope: 'read_themes,write_themes',
      installedAt: new Date().toISOString(),
    };

    const store = new FileTokenStore({ filePath });
    await store.save(record);

    const retrieved = await store.get(record.shop);
    expect(retrieved).toEqual(record);

    const reloaded = new FileTokenStore({ filePath });
    const afterReload = await reloaded.get(record.shop);
    expect(afterReload).toEqual(record);

    const missing = await reloaded.get('missing.myshopify.com');
    expect(missing).toBeNull();
  });
});
