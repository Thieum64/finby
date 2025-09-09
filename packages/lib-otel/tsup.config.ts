import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  treeshake: true,
  dts: true,
  external: [
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/auto-instrumentations-node',
    '@google-cloud/opentelemetry-cloud-trace-exporter',
  ],
});