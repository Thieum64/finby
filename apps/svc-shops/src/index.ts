import path from 'node:path';
import fastify, { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { initOTel, trace, context } from './otel';
import { loadConfig, ServiceConfig, envSchema } from './config';
import { StateStore } from './stores/state-store';
import {
  FileTokenStore,
  SecretManagerTokenStore,
  TokenStore,
} from './stores/token-store';
import { WebhookStore } from './stores/webhook-store';
import { shopsRoutesPlugin } from './routes/shops';

initOTel('svc-shops');

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const runtimeConfig = loadConfig(process.env);

function createTokenStore(config: ServiceConfig, dataDir: string): TokenStore {
  if (typeof config.GOOGLE_CLOUD_PROJECT === 'string') {
    const projectId = config.GOOGLE_CLOUD_PROJECT || config.GCP_PROJECT_ID;
    return new SecretManagerTokenStore({ projectId });
  }

  return new FileTokenStore({ filePath: path.join(dataDir, 'shops.json') });
}

export function createServer(
  config: ServiceConfig = runtimeConfig
): FastifyInstance {
  const dataDir = path.resolve(process.cwd(), config.DATA_DIR);
  const stateStore = new StateStore({
    filePath: path.join(dataDir, 'state.json'),
    ttlMs: config.STATE_TTL_SECONDS * 1000,
    hmacSecret: config.SHOPIFY_API_SECRET,
  });
  const tokenStore = createTokenStore(config, dataDir);
  const webhookStore = new WebhookStore({
    filePath: path.join(dataDir, 'webhooks.json'),
  });

  const server = fastify({
    logger: {
      level: config.LOG_LEVEL as LogLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'res.headers["set-cookie"]',
          'req.headers["x-shopify-access-token"]',
          'req.headers["x-shopify-hmac-sha256"]',
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

  void server.register(shopsRoutesPlugin, {
    prefix: '/v1/shops',
    config,
    stateStore,
    tokenStore,
    webhookStore,
  });

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

  server.get('/healthz', async (_request, _reply) => {
    return 'ok';
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
    server.log.info(
      {
        port: runtimeConfig.PORT,
        env: runtimeConfig.NODE_ENV,
        projectId: runtimeConfig.GCP_PROJECT_ID,
        scopes: runtimeConfig.SHOPIFY_SCOPES,
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
