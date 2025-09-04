import fastify from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';

// Environment validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('8080'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  GCP_PROJECT_ID: z.string().optional(),
});

const env = envSchema.parse(process.env);

// TODO: M1 - Add OpenTelemetry initialization
// TODO: M1 - Add structured logging with correlation IDs
// TODO: M2 - Add Firebase Auth token validation
// TODO: M2 - Add tenant context middleware

const server = fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Global request ID middleware
server.addHook('onRequest', async (request, reply) => {
  const reqId = request.headers['x-request-id'] as string || ulid();
  request.headers['x-request-id'] = reqId;
  reply.header('x-request-id', reqId);
  
  // TODO: M1 - Extract and propagate W3C traceparent header
  // TODO: M1 - Add structured logging fields: tenantId, shopId, reqId
});

// Register plugins function
const registerPlugins = async () => {
  // Security middleware
  await server.register(import('@fastify/helmet'), {
    global: true,
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
    service: 'svc-authz',
    version: '0.1.0',
    time: new Date().toISOString(),
    reqId,
    env: env.NODE_ENV,
    // TODO: M1 - Add traceId from OpenTelemetry context
  };
});

server.get('/healthz', async (_request, _reply) => {
  // TODO: M2 - Add health checks: Firestore connection, secrets access
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      firestore: 'not_implemented',
      secrets: 'not_implemented',
    },
  };
});

// v1 API namespace (future endpoints)
server.register(async function v1Routes(server) {
  // TODO: M2 - Add /v1/me endpoint (current user info)
  // TODO: M2 - Add /v1/tenants endpoints
  // TODO: M3 - Add /v1/invitations endpoints
  
  server.get('/ping', async () => {
    return { message: 'AuthZ service v1 API' };
  });
}, { prefix: '/v1' });

// Error handling
server.setErrorHandler((error, request, reply) => {
  const reqId = request.headers['x-request-id'];
  
  server.log.error({
    error: error.message,
    stack: error.stack,
    reqId,
  }, 'Unhandled error');

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
      host: '0.0.0.0' 
    });
    
    server.log.info({
      port: env.PORT,
      env: env.NODE_ENV,
    }, 'Server started successfully');
  } catch (error) {
    server.log.fatal(error, 'Failed to start server');
    process.exit(1);
  }
};

start();