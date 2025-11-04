#!/usr/bin/env bash
# shellcheck disable=SC2086
set -euo pipefail

# Sample helper script demonstrating how to exercise the svc-shops OAuth/webhook flow locally.
# These commands use placeholder credentials only. Replace values with real secrets when running
# against a non-development environment.

APP_URL=${APP_URL:-http://localhost:8080/v1/shops}
SHOP_DOMAIN=${SHOP_DOMAIN:-demo-shop.myshopify.com}
SHOPIFY_API_KEY=${SHOPIFY_API_KEY:-dev_key}
SHOPIFY_API_SECRET=${SHOPIFY_API_SECRET:-dev_secret}
SHOPIFY_WEBHOOK_SECRET=${SHOPIFY_WEBHOOK_SECRET:-dev_webhook_secret}
SCOPES=${SCOPES:-read_themes,write_themes}

echo "== GET install =="
echo "curl -v \"${APP_URL}/install?shop=${SHOP_DOMAIN}\""
echo

echo "== Simulated callback =="
STATE_PLACEHOLDER='state-from-install'
TIMESTAMP=$(date +%s)
QUERY_STRING="code=fake-code&shop=${SHOP_DOMAIN}&state=${STATE_PLACEHOLDER}&timestamp=${TIMESTAMP}"
HMAC=$(printf '%s' "${QUERY_STRING}" | openssl dgst -sha256 -hmac "${SHOPIFY_API_SECRET}" -hex | awk '{print $NF}')
echo "# Generated HMAC: ${HMAC}"
echo "curl -v \"${APP_URL}/callback?${QUERY_STRING}&hmac=${HMAC}\""
echo

echo "== Simulated webhook =="
WEBHOOK_PAYLOAD='{"id":1,"topic":"app/uninstalled"}'
WEBHOOK_SIGNATURE=$(printf '%s' "${WEBHOOK_PAYLOAD}" | openssl dgst -sha256 -hmac "${SHOPIFY_WEBHOOK_SECRET}" -binary | openssl base64 -A)
echo "# Generated signature: ${WEBHOOK_SIGNATURE}"
cat <<EOF
curl -v -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Shopify-Hmac-Sha256: ${WEBHOOK_SIGNATURE}" \\
  -H "X-Shopify-Webhook-Id: demo-webhook" \\
  -H "X-Shopify-Shop-Domain: ${SHOP_DOMAIN}" \\
  -H "X-Shopify-Topic: app/uninstalled" \\
  --data '${WEBHOOK_PAYLOAD}' \\
  ${APP_URL}/webhooks/shopify
EOF
