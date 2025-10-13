export interface ShopifySecretsProvider {
  getApiKey(): Promise<string>;
  getApiSecret(): Promise<string>;
  getWebhookSecret(): Promise<string>;
}

export interface ShopifySecretEnv {
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_WEBHOOK_SECRET?: string;
}

export class EnvShopifySecretsProvider implements ShopifySecretsProvider {
  constructor(private readonly env: ShopifySecretEnv) {}

  async getApiKey(): Promise<string> {
    return this.require('SHOPIFY_API_KEY');
  }

  async getApiSecret(): Promise<string> {
    return this.require('SHOPIFY_API_SECRET');
  }

  async getWebhookSecret(): Promise<string> {
    return this.require('SHOPIFY_WEBHOOK_SECRET');
  }

  private async require(key: keyof ShopifySecretEnv): Promise<string> {
    const value = this.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    throw new Error(`${key} is not configured`);
  }
}

export const createEnvSecretsProvider = (
  env: ShopifySecretEnv = process.env
): ShopifySecretsProvider => new EnvShopifySecretsProvider(env);
