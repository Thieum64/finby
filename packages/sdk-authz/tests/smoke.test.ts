import { describe, it, expect } from 'vitest';

describe('sdk-authz smoke', () => {
  it('exports public API', async () => {
    const mod = await import('../src/index');
    expect(mod).toBeDefined();
  });
});
