import { describe, it, expect } from 'vitest';

describe('lib-firestore smoke', () => {
  it('exports module surface', async () => {
    const mod = await import('../src/index');
    expect(mod).toBeDefined();
  });
});
