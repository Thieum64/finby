import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileOAuthStateStore } from './state-store';

describe('FileOAuthStateStore', () => {
  it('creates and consumes states with persistence', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'state-store-'));
    const store = new FileOAuthStateStore({
      filePath: path.join(dir, 'state.json'),
      ttlSeconds: 60,
      signingSecret: 'secret',
    });

    const state = await store.create('shop.myshopify.com');
    expect(state.state).toBeDefined();

    const persisted = JSON.parse(
      await readFile(path.join(dir, 'state.json'), 'utf8')
    ) as Array<{ state: string }>;
    expect(persisted).toHaveLength(1);
    expect(persisted[0].state).toBe(state.state);

    const consumed = await store.consume(state.state);
    expect(consumed?.shop).toBe('shop.myshopify.com');

    const consumedAgain = await store.consume(state.state);
    expect(consumedAgain).toBeNull();

    await rm(dir, { recursive: true, force: true });
  });

  it('expires states after TTL', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'state-store-'));
    const store = new FileOAuthStateStore({
      filePath: path.join(dir, 'state.json'),
      ttlSeconds: 0,
      signingSecret: 'secret',
    });

    const state = await store.create('shop.myshopify.com');
    const consumed = await store.consume(state.state);
    expect(consumed).toBeNull();

    await rm(dir, { recursive: true, force: true });
  });
});
