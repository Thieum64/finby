#!/usr/bin/env bash
set -euo pipefail

APP_URL=${APP_URL:-http://localhost:8080}
SHOP_DOMAIN=${SHOP_DOMAIN:-example.myshopify.com}
WEBHOOK_SECRET=${SHOPIFY_WEBHOOK_SECRET:-dev_webhook_secret}
WEBHOOK_ID=${WEBHOOK_ID:-demo-webhook-123}
WEBHOOK_TOPIC=${WEBHOOK_TOPIC:-orders/create}

PAYLOAD='{"event":"orders/create","id":1234}'

print_section() {
  printf '\n=== %s ===\n' "$1"
}

print_section "GET install redirect"
curl -sD - -o /dev/null "${APP_URL}/v1/shops/oauth/install?shop=${SHOP_DOMAIN}" |
  awk '/^Location:/ {print}'

print_section "POST webhook (valid signature)"
VALID_SIGNATURE=$(printf '%s' "${PAYLOAD}" | openssl dgst -sha256 -hmac "${WEBHOOK_SECRET}" -binary | openssl base64)

curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  -X POST "${APP_URL}/v1/shops/webhooks/shopify" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: ${VALID_SIGNATURE}" \
  -H "X-Shopify-Webhook-Id: ${WEBHOOK_ID}" \
  -H "X-Shopify-Topic: ${WEBHOOK_TOPIC}" \
  -H "X-Shopify-Shop-Domain: ${SHOP_DOMAIN}" \
  --data "${PAYLOAD}"

print_section "POST webhook (invalid signature)"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  -X POST "${APP_URL}/v1/shops/webhooks/shopify" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: invalid" \
  -H "X-Shopify-Webhook-Id: invalid-${WEBHOOK_ID}" \
  -H "X-Shopify-Topic: ${WEBHOOK_TOPIC}" \
  -H "X-Shopify-Shop-Domain: ${SHOP_DOMAIN}" \
  --data "${PAYLOAD}"
