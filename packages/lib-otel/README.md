# @hyperush/lib-otel

OpenTelemetry initialization and configuration for Hyperush microservices.

## Usage

```typescript
import { initOTel } from '@hyperush/lib-otel';

// Initialize OpenTelemetry at the very beginning of your service
initOTel('svc-authz');
```

## Features

- Automatic instrumentation for HTTP, Fastify, and Pino
- Cloud Trace integration for GCP
- Graceful shutdown handling
- Test environment detection (skips initialization)
- Prevents multiple initializations

## Environment Variables

- `GCP_PROJECT_ID`: Google Cloud Project ID for Cloud Trace
- `NODE_ENV`: Environment (test/development/production)
- `SERVICE_VERSION`: Service version (defaults to 0.1.0)