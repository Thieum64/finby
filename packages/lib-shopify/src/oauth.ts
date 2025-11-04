import { createHmac, timingSafeEqual } from 'node:crypto';

type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

const EXCLUDED_CALLBACK_KEYS = new Set(['hmac', 'signature']);

function toStringValue(
  value: string | number | boolean | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Shopify treats boolean values as their string representation
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function secureCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function buildAuthorizeUrl(
  shopDomain: string,
  clientId: string,
  scopesCsv: string,
  redirectUri: string,
  state: string
): string {
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopesCsv);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return url.toString();
}

export function verifyCallbackHmac(
  queryParams: Record<string, QueryValue>,
  secret: string
): boolean {
  const parsed: Array<[string, string]> = [];

  for (const [rawKey, rawValue] of Object.entries(queryParams)) {
    const key = rawKey.trim();
    if (EXCLUDED_CALLBACK_KEYS.has(key)) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      const stringValue = toStringValue(value);
      if (stringValue === null) {
        continue;
      }
      parsed.push([key, stringValue]);
    }
  }

  parsed.sort(([keyA, valueA], [keyB, valueB]) => {
    const keyCompare = keyA.localeCompare(keyB);
    if (keyCompare !== 0) {
      return keyCompare;
    }

    return valueA.localeCompare(valueB);
  });

  const canonicalQuery = parsed
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const digest = createHmac('sha256', secret)
    .update(canonicalQuery)
    .digest('hex');

  const providedHmacCandidate = Array.isArray(queryParams.hmac)
    ? queryParams.hmac.find((value) => value !== null && value !== undefined)
    : queryParams.hmac;

  if (providedHmacCandidate === null || providedHmacCandidate === undefined) {
    return false;
  }

  const providedHmac = String(providedHmacCandidate);

  if (providedHmac.length === 0) {
    return false;
  }

  try {
    const expectedBuffer = Buffer.from(digest, 'hex');
    const providedBuffer = Buffer.from(providedHmac, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    // Invalid hex input
    return false;
  }
}

export function verifyWebhookHmac(
  rawBody: Buffer,
  secret: string,
  headerValue: string | string[] | undefined | null
): boolean {
  if (typeof headerValue === 'undefined' || headerValue === null) {
    return false;
  }

  const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!provided || typeof provided !== 'string') {
    return false;
  }

  const digest = createHmac('sha256', secret).update(rawBody).digest('base64');

  return secureCompare(digest, provided);
}

interface ExchangeTokenResponse {
  access_token: string;
  scope: string;
  [key: string]: unknown;
}

export async function exchangeCodeForToken(
  shopDomain: string,
  code: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch
): Promise<ExchangeTokenResponse> {
  const endpoint = `https://${shopDomain}/admin/oauth/access_token`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to exchange authorization code for ${shopDomain}: ${response.status} ${response.statusText} - ${body}`
    );
  }

  const payload = (await response.json()) as ExchangeTokenResponse;

  if (
    typeof payload.access_token !== 'string' ||
    payload.access_token.length === 0
  ) {
    throw new Error(
      `Invalid response while exchanging token for ${shopDomain}: missing access_token`
    );
  }

  if (typeof payload.scope !== 'string') {
    throw new Error(
      `Invalid response while exchanging token for ${shopDomain}: missing scope`
    );
  }

  return {
    access_token: payload.access_token,
    scope: payload.scope,
  };
}
