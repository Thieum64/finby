import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  verifyCallbackHmac,
  verifyWebhookHmac,
} from './oauth';

describe('lib-shopify oauth helpers', () => {
  it('buildAuthorizeUrl produces a fully qualified authorize URL', () => {
    const url = buildAuthorizeUrl(
      'test-shop.myshopify.com',
      'client-123',
      'read_themes,write_themes',
      'https://example.com/callback',
      'state-abc'
    );

    expect(url).toBe(
      'https://test-shop.myshopify.com/admin/oauth/authorize?client_id=client-123&scope=read_themes%2Cwrite_themes&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&state=state-abc'
    );
  });

  it('verifyCallbackHmac returns true for a valid payload', () => {
    const secret = 'dev-secret';
    const canonical =
      'code=123&shop=test.myshopify.com&state=nonce&timestamp=1697040000';
    const hmac = createHmac('sha256', secret).update(canonical).digest('hex');

    const query = {
      code: '123',
      shop: 'test.myshopify.com',
      state: 'nonce',
      timestamp: '1697040000',
      hmac: hmac.toUpperCase(),
    };

    expect(verifyCallbackHmac(query, secret)).toBe(true);
  });

  it('verifyCallbackHmac returns false on mismatch or invalid hex', () => {
    const secret = 'dev-secret';
    const canonical = 'code=123&shop=test.myshopify.com';
    const hmac = createHmac('sha256', secret).update(canonical).digest('hex');

    const query = {
      code: '123',
      shop: 'test.myshopify.com',
      hmac,
    };

    expect(verifyCallbackHmac(query, 'other-secret')).toBe(false);
    expect(verifyCallbackHmac({ ...query, hmac: 'not-hex' }, secret)).toBe(
      false
    );
  });

  it('verifyCallbackHmac supports array values', () => {
    const secret = 'dev-secret';
    const canonical = 'scope=read&scope=write&shop=test.myshopify.com';
    const hmac = createHmac('sha256', secret).update(canonical).digest('hex');

    const query = {
      scope: ['read', 'write'],
      shop: 'test.myshopify.com',
      hmac,
    };

    expect(verifyCallbackHmac(query, secret)).toBe(true);
  });

  it('verifyWebhookHmac validates base64 signature', () => {
    const secret = 'webhook-secret';
    const payload = Buffer.from(JSON.stringify({ id: 1 }), 'utf8');
    const signature = createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    expect(verifyWebhookHmac(payload, secret, signature)).toBe(true);
    expect(verifyWebhookHmac(payload, secret, 'bad')).toBe(false);
    expect(verifyWebhookHmac(payload, secret, undefined)).toBe(false);
  });

  it('exchangeCodeForToken performs HTTP post and validates response', async () => {
    const fakeFetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
        async json() {
          return {
            access_token: 'shpat_123',
            scope: 'read_themes,write_themes',
            extra: 'ignored',
          };
        },
      }) as Response;

    const response = await exchangeCodeForToken(
      'test.myshopify.com',
      'code-123',
      'client',
      'secret',
      fakeFetch as unknown as typeof fetch
    );

    expect(response).toEqual({
      access_token: 'shpat_123',
      scope: 'read_themes,write_themes',
    });
  });

  it('exchangeCodeForToken rejects when Shopify returns error', async () => {
    const fakeFetch = async () =>
      ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        async text() {
          return 'unauthorized';
        },
      }) as Response;

    await expect(
      exchangeCodeForToken(
        'test.myshopify.com',
        'code-123',
        'client',
        'secret',
        fakeFetch as unknown as typeof fetch
      )
    ).rejects.toThrow(/Failed to exchange authorization code/);
  });

  it('exchangeCodeForToken rejects when payload is missing access token', async () => {
    const fakeFetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
        async json() {
          return { scope: 'read' };
        },
      }) as Response;

    await expect(
      exchangeCodeForToken(
        'test.myshopify.com',
        'code-123',
        'client',
        'secret',
        fakeFetch as unknown as typeof fetch
      )
    ).rejects.toThrow(/missing access_token/);
  });
});
