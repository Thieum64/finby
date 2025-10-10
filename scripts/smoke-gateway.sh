#!/usr/bin/env bash
# Smoke test for API Gateway /api/v1/auth endpoints
# This script tests that the gateway correctly proxies to svc-authz

set -e

# Required environment variables:
# - GATEWAY_URL: API Gateway base URL (e.g., https://api.hyperush.dev)
# - JWT: Firebase Auth JWT token for authenticated requests (optional for public routes)
# - TENANT_ID: ULID of a tenant to test access (optional)
# - INVITATION_TOKEN: Token of an invitation to test (optional)

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
JWT="${JWT:-}"
TENANT_ID="${TENANT_ID:-01HZZZZZZZZZZZZZZZZZZZZZZ}"
INVITATION_TOKEN="${INVITATION_TOKEN:-}"

echo "======================================"
echo "API Gateway Smoke Test"
echo "======================================"
echo "Gateway URL: $GATEWAY_URL"
echo ""

# Test 1: GET /api/v1/auth/health (public endpoint)
echo "[1/3] Testing GET /api/v1/auth/health (public)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/v1/auth/health")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ GET /api/v1/auth/health returned 200"
else
  echo "✗ GET /api/v1/auth/health returned $HTTP_CODE (expected 200)"
  exit 1
fi

# Test 2: HEAD /api/v1/auth/tenants/{tenantId}/access (authenticated)
if [ -n "$JWT" ] && [ -n "$TENANT_ID" ]; then
  echo "[2/3] Testing HEAD /api/v1/auth/tenants/$TENANT_ID/access (authenticated)..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X HEAD \
    -H "Authorization: Bearer $JWT" \
    "$GATEWAY_URL/api/v1/auth/tenants/$TENANT_ID/access")

  # We accept both 200 (has access) and 403 (no access) as valid responses
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✓ HEAD /api/v1/auth/tenants/$TENANT_ID/access returned $HTTP_CODE (200/403/404 acceptable)"
  else
    echo "✗ HEAD /api/v1/auth/tenants/$TENANT_ID/access returned $HTTP_CODE (expected 200/403/404)"
    exit 1
  fi
else
  echo "[2/3] Skipping HEAD /api/v1/auth/tenants/{tenantId}/access (JWT or TENANT_ID not provided)"
fi

# Test 3: GET /api/v1/auth/invitations/{token} (public)
if [ -n "$INVITATION_TOKEN" ]; then
  echo "[3/3] Testing GET /api/v1/auth/invitations/$INVITATION_TOKEN (public)..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$GATEWAY_URL/api/v1/auth/invitations/$INVITATION_TOKEN")

  # We accept 200 (valid), 404 (not found), or 410 (expired) as valid responses
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "410" ]; then
    echo "✓ GET /api/v1/auth/invitations/$INVITATION_TOKEN returned $HTTP_CODE (200/404/410 acceptable)"
  else
    echo "✗ GET /api/v1/auth/invitations/$INVITATION_TOKEN returned $HTTP_CODE (expected 200/404/410)"
    exit 1
  fi
else
  echo "[3/3] Skipping GET /api/v1/auth/invitations/{token} (INVITATION_TOKEN not provided)"
fi

echo ""
echo "======================================"
echo "✓ All smoke tests passed!"
echo "======================================"
