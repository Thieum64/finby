import { initOTel } from '@hyperush/lib-otel';
import fastify from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';

// Initialize OpenTelemetry first
initOTel('svc-quality');

// Environment validation (NOTE: PORT is provided by Cloud Run, never set manually)
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('8080'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  GCP_PROJECT_ID: z.string().optional(),
});

const env = envSchema.parse(process.env);

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
    service: 'svc-quality',
    version: '0.1.0',
    time: new Date().toISOString(),
    reqId,
    env: env.NODE_ENV,
  };
});

server.get('/healthz', async (_request, _reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      service: 'ok',
    },
  };
});

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