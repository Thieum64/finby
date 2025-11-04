const SHOP_DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;

export function normalizeShopDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();

  const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
  const [host] = withoutProtocol.split('/');

  if (!host || !SHOP_DOMAIN_REGEX.test(host)) {
    throw new Error('Invalid Shopify shop domain');
  }

  return host;
}
