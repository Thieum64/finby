import { describe, expect, it } from 'vitest';
import { initOTel } from './index.js';

describe('lib-otel', () => {
  it('should export initOTel function', () => {
    expect(typeof initOTel).toBe('function');
  });

  it('should initialize OpenTelemetry without errors', () => {
    expect(() => initOTel('test-service')).not.toThrow();
  });
});
