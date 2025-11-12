import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node20',
  format: ['esm'],
  sourcemap: true,
  clean: true,
});
