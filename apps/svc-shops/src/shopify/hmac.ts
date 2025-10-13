import { createHmac, timingSafeEqual } from 'node:crypto';

export const buildShopifyInstallUrl = (
  shopDomain: string,
  clientId: string,
  scopes: string,
  appUrl: string,
  state: string
): string => {
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('redirect_uri', `${appUrl.replace(/\/?$/, '')}/v1/shops/oauth/callback`);
  url.searchParams.set('state', state);
  return url.toString();
};

const sortQueryParameters = (params: URLSearchParams): URLSearchParams => {
  const entries = Array.from(params.entries()).sort(([aKey], [bKey]) =>
    aKey.localeCompare(bKey)
  );

  const sorted = new URLSearchParams();
  for (const [key, value] of entries) {
    sorted.append(key, value);
  }

  return sorted;
};

export const calculateCallbackHmac = (
  queryParams: URLSearchParams,
  secret: string
): string => {
  const filtered = new URLSearchParams();
  for (const [key, value] of queryParams.entries()) {
    if (key === 'hmac' || key === 'signature') {
      continue;
    }
    filtered.append(key, value);
  }

  const sorted = sortQueryParameters(filtered);
  const message = sorted.toString();
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
};

export const verifyCallbackHmac = (
  queryParams: URLSearchParams,
  secret: string,
  receivedHmac: string
): boolean => {
  const expected = calculateCallbackHmac(queryParams, secret);

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(receivedHmac.toLowerCase(), 'hex')
    );
  } catch {
    return false;
  }
};

export const verifyWebhookHmac = (
  rawBody: Buffer,
  secret: string,
  receivedHmac: string
): boolean => {
  const hmac = createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest();

  try {
    return timingSafeEqual(digest, Buffer.from(receivedHmac, 'base64'));
  } catch {
    return false;
  }
};
