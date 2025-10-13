# svc-shops

Shopify connector service responsible for handling OAuth installs and webhook validation.

## Environment variables

Configure the service with the following variables (see [`.env.example`](./.env.example) for sample development values):

| Variable | Description |
| --- | --- |
| `APP_URL` | Public base URL for the service (e.g. `http://localhost:8080`). Used to build Shopify redirect URIs. |
| `SHOPIFY_API_KEY` | Shopify app client ID. |
| `SHOPIFY_API_SECRET` | Shopify app client secret used for OAuth exchange and HMAC checks. |
| `SHOPIFY_WEBHOOK_SECRET` | Secret used to verify Shopify webhooks. |
| `SHOPIFY_SCOPES` | Comma-separated scopes requested during installation (e.g. `read_products,write_products`). |
| `STATE_TTL_SECONDS` | Optional. Lifetime of OAuth state nonces (defaults to 600 seconds). |
| `DATA_DIR` | Optional. Directory for persisting install tokens and state (`./.data` by default). |

Secrets must never be committed to the repository. For local development copy the example file and adjust values:

```bash
cp apps/svc-shops/.env.example apps/svc-shops/.env
```

## OAuth installation flow

1. `GET /v1/shops/oauth/install?shop={shopDomain}` generates a signed state nonce, stores it in memory and under `${DATA_DIR}/state.json`, then returns a `302` redirect to Shopify with the required parameters (`client_id`, `scope`, `redirect_uri`, `state`).
2. Shopify redirects back to `GET /v1/shops/oauth/callback` with `shop`, `code`, `state`, and `hmac` query parameters.
3. The callback endpoint validates:
   - The `hmac` signature using the app secret. Shopify signs the sorted query string (excluding `hmac`/`signature`) with HMAC-SHA256 and encodes the digest in lowercase hexadecimal.
   - The `state` nonce, ensuring it matches a stored record and has not expired.
4. A POST request is issued to `https://{shop}/admin/oauth/access_token` to exchange the authorization code for an access token.
5. Tokens are saved to `${DATA_DIR}/shops.json` with the shop domain, scope, token, and installation timestamp.
6. The callback responds with `{ ok: true, shop, scope, installedAt }`. You can introspect installation state with `GET /v1/shops/oauth/status?shop={shopDomain}`.

## Webhook verification

`POST /v1/shops/webhooks/shopify` verifies webhook payloads and enforces simple idempotence:

- Shopify sends `X-Shopify-Hmac-Sha256` containing a base64 encoded HMAC-SHA256 signature of the raw request body using `SHOPIFY_WEBHOOK_SECRET`.
- The handler rejects requests with invalid or missing signatures (`401`).
- `X-Shopify-Webhook-Id` is recorded in memory and in `${DATA_DIR}/webhooks.json`; repeated deliveries with the same ID return `200 { deduplicated: true }`.
- No heavy processing occurs in this service—consume the event downstream.

## Running locally

```bash
pnpm --filter @hyperush/svc-shops install
pnpm --filter @hyperush/svc-shops build
pnpm --filter @hyperush/svc-shops start
```

For iterative development:

```bash
pnpm --filter @hyperush/svc-shops dev
```

## Testing

```bash
pnpm --filter @hyperush/svc-shops lint
pnpm --filter @hyperush/svc-shops typecheck
pnpm --filter @hyperush/svc-shops test -- --run
```

Integration tests spin up the Fastify server in-memory, execute the OAuth callback flow with a mocked token exchange, and exercise webhook verification.

## Manual verification helpers

`scripts/dev/shopify-curl-examples.sh` contains ready-to-run curl examples for:

- Fetching the install redirect (shows the `Location` header).
- Sending a signed webhook payload that returns `HTTP 200`.
- Sending an intentionally invalid signature that returns `HTTP 401`.

Adjust environment variables before running:

```bash
APP_URL=http://localhost:8080 SHOP_DOMAIN=my-shop.myshopify.com \
  SHOPIFY_WEBHOOK_SECRET=dev_webhook_secret scripts/dev/shopify-curl-examples.sh
```

## Creating the Shopify app (after backend validation)

When preparing a real Shopify Partners app:

1. Create the app in Shopify Partners and configure:
   - **App URL:** `${APP_URL}` (e.g. `https://your-domain`).
   - **Allowed redirect URL:** `${APP_URL}/v1/shops/oauth/callback`.
   - Requested scopes matching `SHOPIFY_SCOPES`.
2. Retrieve the API key and secret, store them securely (e.g. Secret Manager), and inject them via environment variables or secret resolution in production.
3. Never commit these credentials to source control.

## Health endpoints

- `GET /v1/shops/health` — service health payload for gateway proxying.
- `GET /health` — runtime health check used by Cloud Run.
