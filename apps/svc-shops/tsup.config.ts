import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node20',
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  dts: false,
  noExternal: ['@hp/lib-shopify'],
});
