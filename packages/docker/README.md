# Docker Templates

Universal Docker templates for Hyperush services.

## node-pnpm.Dockerfile

Multi-stage Dockerfile for Node.js services using pnpm workspace.

### Features

- Pinned base image by digest for security and reproducibility
- Multi-stage build with dependency caching
- Non-root user execution
- Built-in health check on `/healthz`
- Optimized for Cloud Run deployment

### Usage

```bash
docker build \
  --file packages/docker/node-pnpm.Dockerfile \
  --build-arg SERVICE=svc-authz \
  --tag my-service:latest \
  .
```

### Build Arguments

- `SERVICE`: Name of the service directory in apps/ (required)

### Security Features

- Uses pinned base image digest (not `latest`)
- Runs as non-root user (nodejs:nodejs)
- Minimal runtime layer
- Health check validation

### Cloud Run Compatibility

- Listens on PORT environment variable (provided by Cloud Run)
- Health check endpoint on `/healthz`
- Graceful shutdown handling
- Non-root execution