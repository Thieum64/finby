import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const libShopifyAlias = resolve(
  currentDir,
  '../../packages/lib-shopify/src/index.ts'
);

export default defineConfig({
  resolve: {
    alias: {
      '@hp/lib-shopify': libShopifyAlias,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
