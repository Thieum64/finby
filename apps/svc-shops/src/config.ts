import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z
    .string()
    .min(1, 'GCP_PROJECT_ID is required')
    .default('local-dev'),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  APP_URL: z
    .string()
    .url('APP_URL must be a valid URL')
    .default('http://localhost:8080/v1/shops'),
  SHOPIFY_API_KEY: z
    .string()
    .min(1, 'SHOPIFY_API_KEY is required')
    .default('dev_key'),
  SHOPIFY_API_SECRET: z
    .string()
    .min(1, 'SHOPIFY_API_SECRET is required')
    .default('dev_secret'),
  SHOPIFY_SCOPES: z
    .string()
    .min(1, 'SHOPIFY_SCOPES is required')
    .default('read_themes,write_themes'),
  SHOPIFY_WEBHOOK_SECRET: z
    .string()
    .min(1, 'SHOPIFY_WEBHOOK_SECRET is required')
    .default('dev_webhook_secret'),
  STATE_TTL_SECONDS: z.coerce.number().min(60).max(3600).default(600),
  DATA_DIR: z.string().default('.data'),
});

export type ServiceConfig = z.infer<typeof envSchema>;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env
): ServiceConfig {
  return envSchema.parse(env);
}
