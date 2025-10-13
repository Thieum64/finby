import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildShopifyInstallUrl,
  calculateCallbackHmac,
  verifyCallbackHmac,
  verifyWebhookHmac,
} from './hmac';

describe('Shopify HMAC utilities', () => {
  it('builds install URL with required parameters', () => {
    const url = buildShopifyInstallUrl(
      'example.myshopify.com',
      'client-id',
      'read_products,write_products',
      'http://localhost:8080',
      'state-value'
    );

    expect(url).toContain('https://example.myshopify.com/admin/oauth/authorize');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('scope=read_products%2Cwrite_products');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fv1%2Fshops%2Foauth%2Fcallback');
    expect(url).toContain('state=state-value');
  });

  it('validates callback HMAC signatures', () => {
    const secret = 'shopify-secret';
    const params = new URLSearchParams({
      code: '1234',
      shop: 'example.myshopify.com',
      state: 'state-value',
      timestamp: '1700000000',
    });

    const hmac = calculateCallbackHmac(params, secret);
    params.set('hmac', hmac);

    expect(verifyCallbackHmac(params, secret, hmac)).toBe(true);
    expect(verifyCallbackHmac(params, secret, 'deadbeef')).toBe(false);
  });

  it('validates webhook HMAC signatures', () => {
    const secret = 'webhook-secret';
    const body = Buffer.from(JSON.stringify({ event: 'shop/update' }));
    const hmac = createHmac('sha256', secret).update(body).digest('base64');

    expect(verifyWebhookHmac(body, secret, hmac)).toBe(true);
    expect(verifyWebhookHmac(body, secret, 'invalid')).toBe(false);
  });
});
