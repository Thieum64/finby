import crypto from 'node:crypto';
import { URLSearchParams } from 'node:url';

export type ShopifySecretKind = 'apiKey' | 'apiSecret' | 'webhookSecret';

const DEFAULT_SECRET_NAMES: Record<ShopifySecretKind, string> = {
  apiKey: 'shopify-api-key',
  apiSecret: 'shopify-api-secret',
  webhookSecret: 'shopify-webhook-secret',
};

const ENV_MAPPING: Record<ShopifySecretKind, string> = {
  apiKey: 'SHOPIFY_API_KEY_SECRET_NAME',
  apiSecret: 'SHOPIFY_API_SECRET_SECRET_NAME',
  webhookSecret: 'SHOPIFY_WEBHOOK_SECRET_SECRET_NAME',
};

export interface SecretEnv {
  SHOPIFY_API_KEY_SECRET_NAME?: string;
  SHOPIFY_API_SECRET_SECRET_NAME?: string;
  SHOPIFY_WEBHOOK_SECRET_SECRET_NAME?: string;
  [key: string]: unknown;
}

export function getSecretNameFromEnv(
  kind: ShopifySecretKind,
  env: SecretEnv = process.env
): string {
  const override = env[ENV_MAPPING[kind]];
  if (typeof override === 'string' && override.trim().length > 0) {
    return override.trim();
  }

  return DEFAULT_SECRET_NAMES[kind];
}

export interface LazySecretHandle {
  readonly secretName: string;
  resolve(): Promise<string>;
}

export function getSecretValueLazy(secretName: string): LazySecretHandle {
  return {
    secretName,
    async resolve(): Promise<string> {
      throw new Error(
        `Secret resolution is not implemented yet for "${secretName}". TODO(phase-2.4): wire Secret Manager.`
      );
    },
  };
}

export function getDefaultSecretNames(): Record<ShopifySecretKind, string> {
  return { ...DEFAULT_SECRET_NAMES };
}

export const DEFAULT_API_VERSION = '2023-10';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ShopifyClientConfig {
  /**
   * my-store.myshopify.com
   */
  shopDomain: string;
  /**
   * Admin API access token obtained during OAuth.
   */
  accessToken: string;
  apiVersion?: string;
  /**
   * Custom fetch implementation (mostly for tests).
   */
  httpClient?: typeof fetch;
  /**
   * Optional custom user agent appended to default header.
   */
  userAgent?: string;
  /**
   * Maximum number of retry attempts for retryable responses.
   * Defaults to 3 (total of 4 tries including the first attempt).
   */
  maxRetries?: number;
  /**
   * Initial delay in milliseconds for exponential backoff.
   */
  initialRetryDelayMs?: number;
}

export interface ShopifyRequestOptions {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ShopifyResponse<T> {
  status: number;
  headers: Headers;
  data: T;
  rateLimit?: ShopifyRateLimitInfo;
}

export interface ShopifyRateLimitInfo {
  used: number;
  limit: number;
  /**
   * Ratio of used/limit between 0 and 1.
   */
  utilization: number;
}

export class ShopifyError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ShopifyError';
    this.status = status;
    this.body = body;
  }
}

function buildUrl({
  shopDomain,
  apiVersion,
  path,
  query,
}: {
  shopDomain: string;
  apiVersion: string;
  path: string;
  query?: ShopifyRequestOptions['query'];
}): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(
    `https://${shopDomain}/admin/api/${apiVersion}/${normalizedPath}`
  );

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export class ShopifyClient {
  private readonly shopDomain: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;
  private readonly userAgent: string;

  constructor(config: ShopifyClientConfig) {
    if (!config.shopDomain) {
      throw new Error('shopDomain is required');
    }

    if (!config.accessToken) {
      throw new Error('accessToken is required');
    }

    this.shopDomain = config.shopDomain;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
    this.fetchImpl = config.httpClient ?? fetch;
    this.maxRetries = Math.max(0, config.maxRetries ?? 3);
    this.initialRetryDelayMs = Math.max(100, config.initialRetryDelayMs ?? 500);
    const suffix = config.userAgent ? ` ${config.userAgent}` : '';
    this.userAgent = `hyperush-svc-shops/0.1.0${suffix}`;
  }

  async request<T = unknown>(options: ShopifyRequestOptions): Promise<ShopifyResponse<T>> {
    const method = options.method ?? 'GET';
    const url = buildUrl({
      shopDomain: this.shopDomain,
      apiVersion: this.apiVersion,
      path: options.path,
      query: options.query,
    });

    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.accessToken,
      'User-Agent': this.userAgent,
      ...options.headers,
    });

    const body = options.body ? JSON.stringify(options.body) : undefined;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: options.signal,
        });

        const rateLimit = extractRateLimitInfo(response.headers);

        if (!response.ok) {
          if (shouldRetry(response.status, response.headers) && attempt < this.maxRetries) {
            const delay = calculateRetryDelay(
              response.status,
              response.headers,
              attempt,
              this.initialRetryDelayMs
            );
            await delayMs(delay);
            attempt += 1;
            continue;
          }

          const errorBody = await safeParseJson(response);
          throw new ShopifyError(
            `Shopify request failed with status ${response.status}`,
            response.status,
            errorBody
          );
        }

        const data = (await safeParseJson(response)) as T;
        return { status: response.status, headers: response.headers, data, rateLimit };
      } catch (error) {
        lastError = error;
        if (error instanceof ShopifyError) {
          throw error;
        }

        if (attempt >= this.maxRetries) {
          throw error;
        }

        const delay = calculateRetryDelay(0, new Headers(), attempt, this.initialRetryDelayMs);
        await delayMs(delay);
        attempt += 1;
      }
    }

    throw lastError ?? new Error('Unexpected Shopify client error');
  }
}

function extractRateLimitInfo(headers: Headers): ShopifyRateLimitInfo | undefined {
  const header = headers.get('x-shopify-shop-api-call-limit');
  if (!header) {
    return undefined;
  }

  const [usedRaw, limitRaw] = header.split('/', 2);
  const used = Number.parseInt(usedRaw, 10);
  const limit = Number.parseInt(limitRaw, 10);

  if (Number.isNaN(used) || Number.isNaN(limit) || limit <= 0) {
    return undefined;
  }

  return {
    used,
    limit,
    utilization: used / limit,
  };
}

function shouldRetry(status: number, headers: Headers): boolean {
  if (status === 429) {
    return true;
  }

  if (status >= 500 && status < 600) {
    return true;
  }

  const retryAfter = headers.get('retry-after');
  return typeof retryAfter === 'string' && retryAfter.trim().length > 0;
}

export function calculateRetryDelay(
  status: number,
  headers: Headers,
  attempt: number,
  baseDelayMs: number
): number {
  const retryAfterHeader = headers.get('retry-after');

  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(seconds)) {
      return Math.max(seconds * 1000, baseDelayMs);
    }

    const retryDate = Date.parse(retryAfterHeader);
    if (!Number.isNaN(retryDate)) {
      const delta = retryDate - Date.now();
      if (delta > 0) {
        return Math.max(delta, baseDelayMs);
      }
    }
  }

  const exponent = attempt + 1;
  return baseDelayMs * Math.pow(2, exponent);
}

function delayMs(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text, parseError: (error as Error).message };
  }
}

export function verifyShopifyHmac(
  params: Record<string, string | string[] | undefined>,
  sharedSecret: string
): boolean {
  if (!sharedSecret) {
    throw new Error('sharedSecret is required for HMAC verification');
  }

  const provided = extractHmacParam(params);
  if (!provided) {
    return false;
  }

  const cleaned = new URLSearchParams();

  const keys = Object.keys(params).filter((key) => key !== 'hmac' && key !== 'signature');
  keys.sort();

  for (const key of keys) {
    const value = params[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        cleaned.append(key, entry);
      }
    } else if (typeof value === 'string') {
      cleaned.append(key, value);
    }
  }

  const computed = crypto
    .createHmac('sha256', sharedSecret)
    .update(cleaned.toString(), 'utf8')
    .digest('hex');

  return timingSafeCompare(Buffer.from(provided, 'utf8'), Buffer.from(computed, 'utf8'));
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  sharedSecret: string,
  signatureHeader: string | null | undefined
): boolean {
  if (!sharedSecret) {
    throw new Error('sharedSecret is required for webhook signature verification');
  }

  if (!signatureHeader) {
    return false;
  }

  const computed = crypto
    .createHmac('sha256', sharedSecret)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
    .digest('base64');

  return timingSafeCompare(
    Buffer.from(signatureHeader, 'utf8'),
    Buffer.from(computed, 'utf8')
  );
}

function extractHmacParam(
  params: Record<string, string | string[] | undefined>
): string | undefined {
  const possible = params['hmac'] ?? params['signature'];
  if (Array.isArray(possible)) {
    return possible[0];
  }

  return possible;
}

function timingSafeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

export function createShopifyClient(config: ShopifyClientConfig): ShopifyClient {
  return new ShopifyClient(config);
}
