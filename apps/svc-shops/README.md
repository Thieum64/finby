# svc-shops

Bootstrap Shopify connector service exposing foundational health endpoints.

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

## API Endpoints

- `GET /v1/shops/health` — Service health payload for gateway proxying
- `GET /health` — Runtime health check used by Cloud Run
