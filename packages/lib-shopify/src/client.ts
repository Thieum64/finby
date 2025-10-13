export type ShopifySecretKind = 'apiKey' | 'apiSecret' | 'webhookSecret';

const DEFAULT_SECRET_NAMES: Record<ShopifySecretKind, string> = {
  apiKey: 'shopify/api-key',
  apiSecret: 'shopify/api-secret',
  webhookSecret: 'shopify/webhook-secret',
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
