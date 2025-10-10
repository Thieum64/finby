import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  noExternal: ['@hp/lib-common', '@hp/lib-firestore'],
});
