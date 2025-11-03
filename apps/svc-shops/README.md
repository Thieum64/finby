# svc-shops

Shopify connector service responsible for handling OAuth installs, callbacks, and webhook verification.

## Environment

Create a `.env` file (see `.env.example`) with the following variables:

- `APP_URL` – Public base URL for the `/v1/shops` routes (ex: `https://svc-api-gateway…/api/v1/shops` or `http://localhost:8080/v1/shops`).
- `SHOPIFY_API_KEY` – Shopify app client ID.
- `SHOPIFY_API_SECRET` – Shopify app client secret.
- `SHOPIFY_SCOPES` – Comma-separated scopes to request during install.
- `SHOPIFY_WEBHOOK_SECRET` – Secret used to verify Shopify webhook signatures.

Additional knobs:

- `STATE_TTL_SECONDS` – Optional, defaults to 600. Controls validity window for OAuth state nonces.
- `DATA_DIR` – Optional, defaults to `.data`. Directory used to persist install state and webhook idempotence in non-production environments.

## Local development

```bash
pnpm install
pnpm --filter @hyperush/svc-shops dev
```

The dev script rebuilds via `tsup` and restarts the Fastify server on change.

Health endpoints:

- `GET /health` – Runtime health (used by Cloud Run / smoke tests)
- `GET /v1/shops/health` – Routed through the API gateway for external checks

## OAuth flow

1. **Install** – `GET /v1/shops/install?shop={subdomain}.myshopify.com`
   - Validates the shop domain format.
   - Generates a signed nonce/state (HMAC with `SHOPIFY_API_SECRET`, 10 minute TTL) stored in memory + `${DATA_DIR}/state.json`.
   - Redirects (302) to Shopify with `client_id`, `scope`, `redirect_uri=${APP_URL}/callback`, and the generated `state`.

2. **Callback** – `GET /v1/shops/callback`
   - Requires `shop`, `code`, `state`, and `hmac` query parameters.
   - Confirms the `state` exists and hasn’t expired, aborting with `401 invalid_state` otherwise.
   - Recomputes the HMAC-SHA256 signature across the query (excluding `hmac`/`signature`) using `SHOPIFY_API_SECRET` and compares in constant time. Rejects with `401 invalid_hmac` on mismatch.
   - Exchanges the temporary `code` for an access token by calling `https://{shop}/admin/oauth/access_token`.
   - Persists `{ shop, access_token, scope, installedAt }` in the configured token store:
     - **Development / tests**: `${DATA_DIR}/shops.json` (atomic file writes).
     - **Production**: Google Secret Manager (secret ID pattern `shopify-shop-{shop}-access-token`).
   - Responds `200 { installed: true, shop }` without exposing sensitive data.

3. **Webhooks** – `POST /v1/shops/webhooks/shopify` (optional but recommended)
   - Requires `X-Shopify-Hmac-Sha256` (base64), `X-Shopify-Webhook-Id`.
   - Validates the signature against the raw request body using `SHOPIFY_WEBHOOK_SECRET`.
   - Ensures idempotence by tracking webhook IDs in `${DATA_DIR}/webhooks.json`.
   - Returns `200 { ok: true, replay: boolean }` or `401 invalid_hmac`.

All Fastify logs redact `Authorization`, `Set-Cookie`, `X-Shopify-Access-Token`, and `X-Shopify-Hmac-Sha256` headers.

## Testing

```bash
pnpm --filter @hyperush/svc-shops lint
pnpm --filter @hyperush/svc-shops test       # Vitest unit + integration
pnpm --filter @hyperush/svc-shops build
```

Integration tests spin up the Fastify instance via `server.inject`, mock the token exchange, and assert persistence within `${DATA_DIR}`.

## Token storage summary

| Environment                                             | Storage                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV=production` or `GOOGLE_CLOUD_PROJECT` present | Google Secret Manager secret per shop (`shopify-shop-{shop}-access-token`) |
| Otherwise                                               | Local file store `${DATA_DIR}/shops.json`                                  |

## Dev utilities

See `scripts/dev/shopify-curl-examples.sh` for example install/callback/webhook invocations using placeholder secrets (no real credentials).
