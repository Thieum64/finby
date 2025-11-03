import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  verifyCallbackHmac,
  verifyWebhookHmac,
} from '@hp/lib-shopify';
import { StateStore } from '../stores/state-store';
import { TokenStore } from '../stores/token-store';
import { WebhookStore } from '../stores/webhook-store';
import { normalizeShopDomain } from '../utils/shop';
import { ServiceConfig } from '../config';

interface ShopsPluginOptions {
  config: ServiceConfig;
  stateStore: StateStore;
  tokenStore: TokenStore;
  webhookStore: WebhookStore;
}

const installQuerySchema = z.object({
  shop: z.string().min(1),
});

const callbackQuerySchema = z.object({
  shop: z.string().min(1),
  code: z.string().min(1),
  state: z.string().min(1),
  hmac: z.string().min(1),
});

function buildCallbackUrl(appUrl: string): string {
  const base = appUrl.endsWith('/') ? appUrl : `${appUrl}/`;
  return new URL('callback', base).toString();
}

export const shopsRoutesPlugin: FastifyPluginAsync<ShopsPluginOptions> = async (
  fastify,
  { config, stateStore, tokenStore, webhookStore }
) => {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request, payload, done) => {
      const buffer = Buffer.isBuffer(payload)
        ? (payload as Buffer)
        : Buffer.from(String(payload));
      (request as typeof request & { rawBody?: Buffer }).rawBody = buffer;
      done(null, buffer);
    }
  );

  fastify.get('/install', async (request, reply) => {
    const validation = installQuerySchema.safeParse(request.query);
    if (!validation.success) {
      request.log.warn(
        { reason: 'invalid_shop_param', issues: validation.error.issues },
        'Shop install request rejected'
      );
      return reply.status(400).send({ error: 'invalid_shop' });
    }

    let shop: string;
    try {
      shop = normalizeShopDomain(validation.data.shop);
    } catch {
      return reply.status(400).send({ error: 'invalid_shop' });
    }

    const { state } = await stateStore.generate(shop);
    const authorizeUrl = buildAuthorizeUrl(
      shop,
      config.SHOPIFY_API_KEY,
      config.SHOPIFY_SCOPES,
      buildCallbackUrl(config.APP_URL),
      state
    );

    request.log.info({ shop }, 'Redirecting to Shopify install');

    return reply.redirect(authorizeUrl, 302);
  });

  fastify.get('/callback', async (request, reply) => {
    const validation = callbackQuerySchema.safeParse(request.query);
    if (!validation.success) {
      return reply.status(400).send({ error: 'missing_params' });
    }

    let shop: string;
    try {
      shop = normalizeShopDomain(validation.data.shop);
    } catch {
      return reply.status(400).send({ error: 'invalid_shop' });
    }

    const stateEntry = await stateStore.consume(validation.data.state);
    if (!stateEntry || stateEntry.shop !== shop) {
      request.log.warn({ shop }, 'State validation failed');
      return reply.status(401).send({ error: 'invalid_state' });
    }

    const queryRecord = request.query as Record<string, string | string[]>;
    const hmacValid = verifyCallbackHmac(
      queryRecord,
      config.SHOPIFY_API_SECRET
    );
    if (!hmacValid) {
      request.log.warn({ shop }, 'Callback HMAC validation failed');
      return reply.status(401).send({ error: 'invalid_hmac' });
    }

    try {
      const { access_token: accessToken, scope } = await exchangeCodeForToken(
        shop,
        validation.data.code,
        config.SHOPIFY_API_KEY,
        config.SHOPIFY_API_SECRET
      );

      await tokenStore.save({
        shop,
        access_token: accessToken,
        scope,
        installedAt: new Date().toISOString(),
      });

      request.log.info({ shop }, 'Shop installed successfully');

      return reply.status(200).send({
        installed: true,
        shop,
      });
    } catch (error) {
      request.log.error(
        { shop, err: (error as Error).message },
        'OAuth token exchange failed'
      );
      return reply.status(502).send({ error: 'token_exchange_failed' });
    }
  });

  fastify.post(
    '/webhooks/shopify',
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      const signature = request.headers['x-shopify-hmac-sha256'] as
        | string
        | string[]
        | undefined;
      const webhookId = request.headers['x-shopify-webhook-id'] as
        | string
        | undefined;
      const topic = request.headers['x-shopify-topic'] as string | undefined;
      const shopHeader = request.headers['x-shopify-shop-domain'] as
        | string
        | undefined;

      if (!webhookId) {
        return reply.status(400).send({ error: 'missing_webhook_id' });
      }

      const candidate = (request as typeof request & { rawBody?: unknown })
        .rawBody;
      if (candidate === null || candidate === undefined) {
        return reply.status(400).send({ error: 'missing_body' });
      }

      const rawBody = Buffer.isBuffer(candidate)
        ? (candidate as Buffer)
        : Buffer.from(String(candidate));
      const verified = verifyWebhookHmac(
        rawBody,
        config.SHOPIFY_WEBHOOK_SECRET,
        signature
      );
      if (!verified) {
        request.log.warn(
          { webhookId, shop: shopHeader },
          'Webhook signature validation failed'
        );
        return reply.status(401).send({ error: 'invalid_hmac' });
      }

      const fresh = await webhookStore.markHandled(webhookId, {
        shop: shopHeader ?? null,
        topic: topic ?? null,
      });

      request.log.info(
        { webhookId, shop: shopHeader, topic, replay: !fresh },
        'Shopify webhook processed'
      );

      return reply.status(200).send({
        ok: true,
        replay: !fresh,
      });
    }
  );
};
