import { initOTel, trace, context } from './otel';
initOTel('svc-shops');

import fastify, { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getSecretNameFromEnv } from '@hp/lib-shopify';

declare module 'fastify' {
  interface FastifyInstance {
    shopifySecrets: {
      apiKey: string;
      apiSecret: string;
      webhook: string;
    };
  }
}

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z.string().min(1, 'GCP_PROJECT_ID is required').default('local-dev'),
  SHOPIFY_API_KEY_SECRET_NAME: z
    .string()
    .min(1, 'SHOPIFY_API_KEY_SECRET_NAME is required')
    .default('shopify-api-key'),
  SHOPIFY_API_SECRET_SECRET_NAME: z
    .string()
    .min(1, 'SHOPIFY_API_SECRET_SECRET_NAME is required')
    .default('shopify-api-secret'),
  SHOPIFY_WEBHOOK_SECRET_SECRET_NAME: z
    .string()
    .min(1, 'SHOPIFY_WEBHOOK_SECRET_SECRET_NAME is required')
    .default('shopify-webhook-secret'),
});

type ServiceConfig = z.infer<typeof envSchema>;

const runtimeConfig = envSchema.parse(process.env);

export function createServer(config: ServiceConfig = runtimeConfig): FastifyInstance {
  const server = fastify({
    logger: {
      level: config.LOG_LEVEL as LogLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'res.headers["set-cookie"]',
        ],
        censor: '***',
      },
      ...(config.NODE_ENV === 'production'
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true },
            },
          }),
    },
    genReqId: () => ulid(),
  });

  const resolvedSecretNames = {
    apiKey: getSecretNameFromEnv('apiKey', config),
    apiSecret: getSecretNameFromEnv('apiSecret', config),
    webhook: getSecretNameFromEnv('webhookSecret', config),
  };

  server.decorate('shopifySecrets', resolvedSecretNames);

  server.addHook('onRequest', async (request, reply) => {
    const reqId =
      (request.headers['x-request-id'] as string) || request.id || ulid();
    request.headers['x-request-id'] = reqId;
    reply.header('x-request-id', reqId);

    const span = trace.getActiveSpan() ?? trace.getSpan(context.active());
    if (span) {
      const { traceId, spanId } = span.spanContext();
      request.log = request.log.child({ trace_id: traceId, span_id: spanId });
      reply.header('traceparent', `00-${traceId}-${spanId}-01`);
    }
  });

  server.get('/v1/shops/health', async (request) => {
    return {
      ok: true,
      service: 'svc-shops',
      projectId: config.GCP_PROJECT_ID,
      requestId: request.headers['x-request-id'],
      timestamp: new Date().toISOString(),
      secrets: resolvedSecretNames,
    };
  });

  server.get('/health', async (request) => {
    const span = trace.getActiveSpan() ?? trace.getSpan(context.active());
    return {
      ok: true,
      service: 'svc-shops',
      requestId: request.headers['x-request-id'],
      timestamp: new Date().toISOString(),
      ...(span && {
        trace: {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
        },
      }),
    };
  });

  server.setErrorHandler((error, request, reply) => {
    const reqId = request.headers['x-request-id'];
    request.log.error(
      {
        err: {
          message: error.message,
          stack: config.NODE_ENV === 'development' ? error.stack : undefined,
        },
        reqId,
      },
      'Unhandled error'
    );

    reply.status(500).send({
      error: 'Internal Server Error',
      reqId,
      timestamp: new Date().toISOString(),
    });
  });

  return server;
}

const server = createServer(runtimeConfig);

async function start(): Promise<void> {
  try {
    await server.listen({ port: runtimeConfig.PORT, host: '0.0.0.0' });
    const secretNames = server.shopifySecrets ?? {
      apiKey: runtimeConfig.SHOPIFY_API_KEY_SECRET_NAME,
      apiSecret: runtimeConfig.SHOPIFY_API_SECRET_SECRET_NAME,
      webhook: runtimeConfig.SHOPIFY_WEBHOOK_SECRET_SECRET_NAME,
    };

    server.log.info(
      {
        port: runtimeConfig.PORT,
        env: runtimeConfig.NODE_ENV,
        projectId: runtimeConfig.GCP_PROJECT_ID,
        secrets: secretNames,
      },
      'svc-shops service started'
    );
  } catch (error) {
    server.log.fatal(error, 'Failed to start svc-shops');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

const shutdown = async () => {
  try {
    await server.close();
    server.log.info('svc-shops service stopped');
    process.exit(0);
  } catch (error) {
    server.log.error(error, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { runtimeConfig as envConfig, envSchema };
