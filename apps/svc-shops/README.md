# svc-shops

Bootstrap Shopify connector service exposing foundational health endpoints.
Phase 2.1 wires runtime Shopify secret resolution, OpenTelemetry tracing, and
basic OpenAPI documentation ahead of the OAuth implementation delivered in
Phase 2.3.

## Development

```bash
pnpm install
pnpm --filter @hyperush/svc-shops dev
```

## Build

```bash
pnpm --filter @hyperush/svc-shops build
```

## Test

```bash
pnpm --filter @hyperush/svc-shops test
```

## API & Contracts

- `GET /v1/shops/health` — Service health payload for gateway proxying, returns
  resolved Secret Manager resource names for observability.
- `GET /health` — Runtime health check used by Cloud Run.
- OpenAPI stub: [`packages/contracts/openapi/shops.yaml`](../../packages/contracts/openapi/shops.yaml)

The service emits structured logs annotated with the resolved secret resource
names (never secret values) to confirm the deployment wiring.
