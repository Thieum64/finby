import path from 'node:path';
import { z } from 'zod';

const defaultDataDir = path.resolve(process.cwd(), '.data');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z.string().min(1, 'GCP_PROJECT_ID is required').default('local-dev'),
  APP_URL: z.string().url('APP_URL must be a valid URL'),
  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1, 'SHOPIFY_WEBHOOK_SECRET is required'),
  SHOPIFY_SCOPES: z.string().min(1, 'SHOPIFY_SCOPES is required'),
  STATE_TTL_SECONDS: z.coerce.number().positive().default(600),
  DATA_DIR: z.string().default(defaultDataDir),
});

export type ServiceConfig = z.infer<typeof envSchema>;

export const loadConfig = (): ServiceConfig => envSchema.parse(process.env);
