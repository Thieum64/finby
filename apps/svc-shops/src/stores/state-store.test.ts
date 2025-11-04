import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { StateStore } from './state-store';

describe('StateStore', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'state-store-'));
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('generates and consumes state with TTL enforcement', async () => {
    const filePath = join(dir, 'state.json');
    const store = new StateStore({
      filePath,
      ttlMs: 1_000,
      hmacSecret: 'test-secret',
    });

    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const { state, expiresAt } = await store.generate(
      'test-shop.myshopify.com'
    );

    expect(state).toMatch(/\./);
    expect(expiresAt).toBeGreaterThan(Number(new Date()));

    // Within TTL it should be consumable
    vi.advanceTimersByTime(500);
    const consumed = await store.consume(state);
    expect(consumed?.shop).toBe('test-shop.myshopify.com');

    // Consuming again should return null
    const second = await store.consume(state);
    expect(second).toBeNull();

    // Expired states are removed
    const { state: expiredState } = await store.generate(
      'test-shop.myshopify.com'
    );
    vi.advanceTimersByTime(2_000);
    const expired = await store.consume(expiredState);
    expect(expired).toBeNull();

    // File is persisted with version metadata
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    expect(data.version).toBe(1);
  });
});
