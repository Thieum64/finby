import path from 'node:path';
import { initOTel, context, trace } from './otel';
initOTel('svc-shops');

import fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { loadConfig, envSchema, type ServiceConfig } from './config';
import {
  buildShopifyInstallUrl,
  verifyCallbackHmac,
  verifyWebhookHmac,
} from './shopify/hmac';
import {
  createFileOAuthStateStore,
  type OAuthStateStore,
} from './shopify/state-store';
import {
  createEnvSecretsProvider,
  type ShopifySecretsProvider,
} from './secrets';
import {
  createFileTokenStore,
  type TokenStore,
} from './stores/token-store';
import {
  createFileWebhookStore,
  type WebhookStore,
} from './stores/webhook-store';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

type HttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type HttpClient = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<HttpResponse>;

export interface ServerDependencies {
  secretsProvider?: ShopifySecretsProvider;
  stateStore?: OAuthStateStore;
  tokenStore?: TokenStore;
  webhookStore?: WebhookStore;
  httpClient?: HttpClient;
  now?: () => Date;
}

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

let runtimeConfig: ServiceConfig;

try {
  runtimeConfig = loadConfig();
} catch (error) {
  if (process.env.NODE_ENV === 'test') {
    runtimeConfig = envSchema.parse({
      NODE_ENV: 'test',
      PORT: '8080',
      LOG_LEVEL: 'info',
      GCP_PROJECT_ID: 'local-dev',
      APP_URL: process.env.APP_URL ?? 'http://localhost:8080',
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ?? 'test_key',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ?? 'test_secret',
      SHOPIFY_WEBHOOK_SECRET:
        process.env.SHOPIFY_WEBHOOK_SECRET ?? 'test_webhook_secret',
      SHOPIFY_SCOPES:
        process.env.SHOPIFY_SCOPES ?? 'read_products,write_products',
      STATE_TTL_SECONDS: process.env.STATE_TTL_SECONDS ?? '600',
      DATA_DIR: process.env.DATA_DIR ?? path.resolve(process.cwd(), '.data'),
    });
  } else {
    throw error;
  }
}

export function createServer(
  config: ServiceConfig = runtimeConfig,
  dependencies: ServerDependencies = {}
): FastifyInstance {
  const secretsProvider =
    dependencies.secretsProvider ??
    createEnvSecretsProvider({
      SHOPIFY_API_KEY: config.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: config.SHOPIFY_API_SECRET,
      SHOPIFY_WEBHOOK_SECRET: config.SHOPIFY_WEBHOOK_SECRET,
    });

  const stateStore =
    dependencies.stateStore ??
    createFileOAuthStateStore({
      filePath: path.join(config.DATA_DIR, 'state.json'),
      ttlSeconds: config.STATE_TTL_SECONDS,
      signingSecret: config.SHOPIFY_API_SECRET,
    });

  const tokenStore =
    dependencies.tokenStore ??
    createFileTokenStore(path.join(config.DATA_DIR, 'shops.json'));

  const webhookStore =
    dependencies.webhookStore ??
    createFileWebhookStore(path.join(config.DATA_DIR, 'webhooks.json'));

  const httpClient: HttpClient =
    dependencies.httpClient ?? ((globalThis.fetch as unknown) as HttpClient);
  const now = dependencies.now ?? (() => new Date());

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

  server.addHook('preParsing', async (request, _reply, payload) => {
    if (
      request.method === 'POST' &&
      request.url.startsWith('/v1/shops/webhooks/shopify')
    ) {
      if (!payload) {
        return payload;
      }

      if (Buffer.isBuffer(payload)) {
        (request as FastifyRequest & { rawBody?: Buffer }).rawBody = payload;
        return payload;
      }

      if (typeof payload === 'string') {
        const buffer = Buffer.from(payload);
        (request as FastifyRequest & { rawBody?: Buffer }).rawBody = buffer;
        return buffer;
      }

      if (Symbol.asyncIterator in Object(payload)) {
        const chunks: Buffer[] = [];
        for await (const chunk of payload as AsyncIterable<Buffer | string>) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const buffer = Buffer.concat(chunks);
        (request as FastifyRequest & { rawBody?: Buffer }).rawBody = buffer;
        return buffer;
      }
    }

    return payload;
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

  server.get('/v1/shops/oauth/install', async (request, reply) => {
    const querySchema = z.object({ shop: z.string().min(1) });
    const { shop } = querySchema.parse(request.query);

    const state = await stateStore.create(shop);
    const clientId = await secretsProvider.getApiKey();
    const installUrl = buildShopifyInstallUrl(
      shop,
      clientId,
      config.SHOPIFY_SCOPES,
      config.APP_URL,
      state.state
    );

    request.log.info({ shop, state: state.state }, 'Redirecting to Shopify install');
    reply.redirect(302, installUrl);
  });

  server.get('/v1/shops/oauth/callback', async (request, reply) => {
    const querySchema = z.object({
      shop: z.string().min(1),
      code: z.string().min(1),
      state: z.string().min(1),
      hmac: z.string().min(1),
    });
    const query = querySchema.parse(request.query);

    const params = new URLSearchParams();
    const rawQuery = request.query as Record<string, string | string[]>;
    for (const [key, value] of Object.entries(rawQuery)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          params.append(key, item);
        }
      } else if (typeof value === 'string') {
        params.append(key, value);
      }
    }

    const apiSecret = await secretsProvider.getApiSecret();
    if (!verifyCallbackHmac(params, apiSecret, query.hmac)) {
      reply.status(401).send({ error: 'Invalid HMAC signature' });
      return;
    }

    const stateRecord = await stateStore.consume(query.state);
    if (!stateRecord || stateRecord.shop !== query.shop) {
      reply.status(400).send({ error: 'Invalid or expired OAuth state' });
      return;
    }

    const apiKey = await secretsProvider.getApiKey();

    try {
      const response = await httpClient(
        `https://${query.shop}/admin/oauth/access_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: apiKey,
            client_secret: apiSecret,
            code: query.code,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        request.log.error(
          { status: response.status, body },
          'Failed to exchange Shopify access token'
        );
        reply
          .status(502)
          .send({ error: 'Failed to exchange Shopify access token' });
        return;
      }

      const payload = (await response.json()) as {
        access_token?: string;
        scope?: string;
      };

      if (!payload.access_token) {
        reply.status(502).send({ error: 'Missing access token in response' });
        return;
      }

      const installedAt = now().toISOString();
      await tokenStore.save({
        shop: query.shop,
        accessToken: payload.access_token,
        scope: payload.scope ?? '',
        installedAt,
      });

      request.log.info(
        { shop: query.shop, scope: payload.scope },
        'Shopify app installed successfully'
      );

      reply.status(200).send({
        ok: true,
        shop: query.shop,
        scope: payload.scope ?? '',
        installedAt,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Unexpected error during OAuth callback');
      reply.status(500).send({ error: 'Unexpected error during OAuth callback' });
    }
  });

  server.get('/v1/shops/oauth/status', async (request) => {
    const querySchema = z.object({ shop: z.string().min(1) });
    const { shop } = querySchema.parse(request.query);

    const record = await tokenStore.get(shop);
    return {
      shop,
      installed: Boolean(record),
      scope: record?.scope ?? null,
      installedAt: record?.installedAt ?? null,
    };
  });

  server.post('/v1/shops/webhooks/shopify', async (request, reply) => {
    const hmacHeader = request.headers['x-shopify-hmac-sha256'];
    if (typeof hmacHeader !== 'string' || hmacHeader.length === 0) {
      reply.status(401).send({ error: 'Missing webhook signature' });
      return;
    }

    const rawBody =
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body ?? {}));

    const webhookSecret = await secretsProvider.getWebhookSecret();
    if (!verifyWebhookHmac(rawBody, webhookSecret, hmacHeader)) {
      reply.status(401).send({ error: 'Invalid webhook signature' });
      return;
    }

    const webhookId = request.headers['x-shopify-webhook-id'];
    if (typeof webhookId !== 'string' || webhookId.length === 0) {
      reply.status(400).send({ error: 'Missing webhook id' });
      return;
    }

    if (await webhookStore.has(webhookId)) {
      request.log.info(
        { webhookId },
        'Duplicate Shopify webhook received and ignored'
      );
      reply.status(200).send({ ok: true, deduplicated: true });
      return;
    }

    await webhookStore.remember(webhookId);

    const topic = request.headers['x-shopify-topic'];
    const shopDomain = request.headers['x-shopify-shop-domain'];

    request.log.info(
      { topic, shopDomain, webhookId },
      'Shopify webhook processed'
    );

    reply.status(200).send({ ok: true });
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
        appUrl: runtimeConfig.APP_URL,
        scopes: runtimeConfig.SHOPIFY_SCOPES,
        dataDir: runtimeConfig.DATA_DIR,
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
