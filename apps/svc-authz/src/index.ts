// Initialize OpenTelemetry BEFORE any other imports
import { initOTel } from './otel';
initOTel('svc-authz');

import fastify from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { trace, context } from '@opentelemetry/api';
import authPlugin from './plugins/auth';
import healthRoutes from './routes/health';
import meRoutes from './routes/me';
import tenantsRoutes from './routes/tenants';
import tenantAccessRoutes from './routes/tenantAccess';
import invitationsRoutes from './routes/invitations';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

// Environment validation (NOTE: PORT is provided by Cloud Run, never set manually)
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z.string().default('hyperush-dev-250930115246'),
  FIREBASE_PROJECT_ID: z.string().default('hyperush-dev-250930115246'),
  ENFORCE_INVITE_EMAIL: z.enum(['true', 'false']).default('true'),
});

const env = envSchema.parse(process.env);

// Export env for use in routes
export { env };

const server = fastify({
  logger: {
    level: env.LOG_LEVEL,
    // JSON logs for production, pretty for development
    ...(env.NODE_ENV === 'production'
      ? {}
      : { transport: { target: 'pino-pretty' } }),
  },
  // Automatically generate request ID if not provided
  genReqId: () => ulid(),
});

// Global request ID and tracing middleware
server.addHook('onRequest', async (request, reply) => {
  // Handle request ID
  const reqId =
    (request.headers['x-request-id'] as string) || request.id || ulid();
  request.headers['x-request-id'] = reqId;
  reply.header('x-request-id', reqId);

  // Get current span and add trace context to logs
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    // Add trace context to request for logging
    request.log = request.log.child({
      trace_id: traceId,
      span_id: spanId,
    });

    // Add W3C traceparent header to response for client tracing
    const traceparent = `00-${traceId}-${spanId}-01`;
    reply.header('traceparent', traceparent);
  }
});

// Register plugins function
const registerPlugins = async () => {
  // Auth plugin (must be registered before routes that need it)
  await server.register(authPlugin);

  // Security middleware with enhanced security headers
  await server.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await server.register(cors, {
    origin: env.NODE_ENV === 'development' ? ['http://localhost:3000'] : false,
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
};

// Health check endpoints
server.get('/', async (request, _reply) => {
  const reqId = request.headers['x-request-id'];

  return {
    service: 'svc-authz',
    version: '0.1.0',
    time: new Date().toISOString(),
    reqId,
    env: env.NODE_ENV,
  };
});

server.get('/health', async (request, _reply) => {
  const span = trace.getActiveSpan();

  // Try to get active span context from current context if span is not available
  const activeSpan = span || trace.getSpan(context.active());

  const result = {
    ok: true,
    service: 'svc-authz',
    timestamp: new Date().toISOString(),
    requestId: request.headers['x-request-id'],
    ...(activeSpan && {
      trace: {
        traceId: activeSpan.spanContext().traceId,
        spanId: activeSpan.spanContext().spanId,
      },
    }),
  };

  // Log health check with trace context
  request.log.info({ health_check: result }, 'Health check performed');

  return result;
});

// v1 API namespace (future endpoints)
server.register(
  async function v1Routes(server) {
    // Register auth routes under /auth prefix
    await server.register(healthRoutes, { prefix: '/auth' });
    await server.register(meRoutes, { prefix: '/auth' });
    await server.register(tenantsRoutes, { prefix: '/auth' });
    await server.register(tenantAccessRoutes, { prefix: '/auth' });
    await server.register(invitationsRoutes, { prefix: '/auth' });

    server.get('/ping', async () => {
      return { message: 'AuthZ service v1 API' };
    });

    // E2E test endpoint with enhanced tracing
    server.get('/trace-test', async (request, _reply) => {
      const span = trace.getActiveSpan();
      // Try multiple ways to get the active span
      const activeSpan = span || trace.getSpan(context.active());

      if (activeSpan) {
        // Add custom span attributes
        activeSpan.setAttributes({
          'test.type': 'e2e',
          'test.endpoint': '/v1/trace-test',
          'service.name': 'svc-authz',
        });

        const spanContext = activeSpan.spanContext();
        const traceId = spanContext.traceId;
        const spanId = spanContext.spanId;

        // Create trace URL for Cloud Trace
        const projectId =
          process.env.GCP_PROJECT_ID || 'hyperush-dev-250930115246';
        const traceUrl = `https://console.cloud.google.com/traces/details/${traceId}?project=${projectId}`;

        const result = {
          message: 'E2E trace test successful',
          trace: {
            traceId,
            spanId,
            traceUrl,
          },
          timestamp: new Date().toISOString(),
          requestId: request.headers['x-request-id'],
        };

        // Log with trace URL for CI verification
        request.log.info(
          {
            test_trace: result,
            trace_url: traceUrl,
          },
          `E2E trace test completed - View trace: ${traceUrl}`
        );

        return result;
      }

      // Try to get trace ID from headers or create a manual span
      const tracer = trace.getTracer('svc-authz', '0.1.0');
      return tracer.startActiveSpan('manual-trace-test', (manualSpan) => {
        const spanContext = manualSpan.spanContext();
        const traceId = spanContext.traceId;
        const spanId = spanContext.spanId;

        manualSpan.setAttributes({
          'test.type': 'e2e-manual',
          'test.endpoint': '/v1/trace-test',
          'service.name': 'svc-authz',
        });

        const projectId =
          process.env.GCP_PROJECT_ID || 'hyperush-dev-250930115246';
        const traceUrl = `https://console.cloud.google.com/traces/details/${traceId}?project=${projectId}`;

        const result = {
          message: 'E2E trace test successful (manual span)',
          trace: {
            traceId,
            spanId,
            traceUrl,
          },
          timestamp: new Date().toISOString(),
          requestId: request.headers['x-request-id'],
        };

        request.log.info(
          {
            test_trace: result,
            trace_url: traceUrl,
          },
          `E2E trace test completed (manual) - View trace: ${traceUrl}`
        );

        manualSpan.end();
        return result;
      });
    });
  },
  { prefix: '/v1' }
);

// Error handling
server.setErrorHandler((error, request, reply) => {
  const reqId = request.headers['x-request-id'];

  server.log.error(
    {
      error: error.message,
      stack: error.stack,
      reqId,
    },
    'Unhandled error'
  );

  reply.status(500).send({
    error: 'Internal Server Error',
    reqId,
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  server.log.info('Shutting down gracefully...');

  try {
    await server.close();
    process.exit(0);
  } catch (error) {
    server.log.error(error, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
const start = async () => {
  try {
    // Register all plugins first
    await registerPlugins();

    await server.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    server.log.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
      },
      'Server started successfully'
    );
  } catch (error) {
    server.log.fatal(error, 'Failed to start server');
    process.exit(1);
  }
};

start();
