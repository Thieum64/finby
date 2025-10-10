import { z } from 'zod';

export const envSchema = z.object({
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z.string().default('hyperush-dev-250930115246'),
  FIREBASE_PROJECT_ID: z.string().default('hyperush-dev-250930115246'),
  ENFORCE_INVITE_EMAIL: z.enum(['true', 'false']).default('true'),
});

export const env = envSchema.parse(process.env);
