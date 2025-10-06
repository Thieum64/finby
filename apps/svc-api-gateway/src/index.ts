// Initialize OpenTelemetry BEFORE any other imports
import { initOTel } from './otel';
initOTel('svc-api-gateway');

import fastify from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { trace, context } from '@opentelemetry/api';

// Environment validation (NOTE: PORT is provided by Cloud Run, never set manually)
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z.string().default('hyperush-dev-250930115246'),
  SVC_AUTHZ_URL: z
    .string()
    .default('https://svc-authz-2gc7gddpva-ew.a.run.app'),
});

const env = envSchema.parse(process.env);

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
  // Security middleware with enhanced security headers
  await server.register(import('@fastify/helmet'), {
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

  await server.register(import('@fastify/cors'), {
    origin: env.NODE_ENV === 'development' ? ['http://localhost:3000'] : false,
  });

  await server.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
  });
};

// Health check endpoints
server.get('/', async (request, _reply) => {
  const reqId = request.headers['x-request-id'];

  return {
    service: 'svc-api-gateway',
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
    service: 'svc-api-gateway',
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

// API Gateway routing
server.register(
  async function apiGatewayRoutes(server) {
    // Route /auth/** to svc-authz
    server.register(import('@fastify/http-proxy'), {
      upstream: env.SVC_AUTHZ_URL,
      prefix: '/auth',
      rewritePrefix: '',
      http2: false,
      preHandler: (request, reply, done) => {
        // Add custom headers for internal service communication
        request.headers['x-gateway-source'] = 'svc-api-gateway';
        request.headers['x-gateway-version'] = '0.1.0';
        done();
      },
    });

    // Route /api/v1/** for future services
    server.get('/api/v1/ping', async () => {
      return { message: 'API Gateway v1 ready for routing' };
    });

    // Add placeholder routes for future services
    server.get('/api/v1/status', async (request, _reply) => {
      const span = trace.getActiveSpan();
      const activeSpan = span || trace.getSpan(context.active());

      return {
        gateway: 'svc-api-gateway',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'],
        routes: {
          '/auth/**': env.SVC_AUTHZ_URL,
          '/api/v1/jobs/**': 'TBD - Cloud Run Jobs',
          '/api/v1/notifications/**': 'TBD - Future service',
        },
        ...(activeSpan && {
          trace: {
            traceId: activeSpan.spanContext().traceId,
            spanId: activeSpan.spanContext().spanId,
          },
        }),
      };
    });
  },
  { prefix: '' }
);

// E2E test endpoint with enhanced tracing
server.get('/v1/trace-test', async (request, _reply) => {
  const span = trace.getActiveSpan();
  // Try multiple ways to get the active span
  const activeSpan = span || trace.getSpan(context.active());

  if (activeSpan) {
    // Add custom span attributes
    activeSpan.setAttributes({
      'test.type': 'e2e',
      'test.endpoint': '/v1/trace-test',
      'service.name': 'svc-api-gateway',
    });

    const spanContext = activeSpan.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    // Create trace URL for Cloud Trace
    const projectId = process.env.GCP_PROJECT_ID || 'hyperush-dev-250930115246';
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
  const tracer = trace.getTracer('svc-api-gateway', '0.1.0');
  return tracer.startActiveSpan('manual-trace-test', (manualSpan) => {
    const spanContext = manualSpan.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    manualSpan.setAttributes({
      'test.type': 'e2e-manual',
      'test.endpoint': '/v1/trace-test',
      'service.name': 'svc-api-gateway',
    });

    const projectId = process.env.GCP_PROJECT_ID || 'hyperush-dev-250930115246';
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
      'API Gateway started successfully'
    );
  } catch (error) {
    server.log.fatal(error, 'Failed to start server');
    process.exit(1);
  }
};

start();
