// Initialize OpenTelemetry BEFORE any other imports
import { initOTel, shutdownOTel } from './otel';
initOTel('worker-jobs');

import fastify from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

// Environment validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  GCP_PROJECT_ID: z.string().default('hyperush-dev-250930115246'),
  PUBSUB_SUBSCRIPTION: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Pub/Sub message schema (Google Cloud format)
const pubsubMessageSchema = z.object({
  message: z.object({
    data: z.string(), // Base64 encoded
    attributes: z.record(z.string()).optional(),
    messageId: z.string(),
    publishTime: z.string(),
  }),
  subscription: z.string(),
});

const server = fastify({
  logger: {
    level: env.LOG_LEVEL,
    // JSON logs for production, pretty for development
    ...(env.NODE_ENV === 'production'
      ? {}
      : { transport: { target: 'pino-pretty' } }),
  },
  genReqId: () => ulid(),
});

// Global request ID and tracing middleware
server.addHook('onRequest', async (request, reply) => {
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

    request.log = request.log.child({
      trace_id: traceId,
      span_id: spanId,
    });

    // Add W3C traceparent header to response
    const traceparent = `00-${traceId}-${spanId}-01`;
    reply.header('traceparent', traceparent);
  }
});

// Job processing function
async function processJob(
  jobData: any,
  messageId: string,
  logger: any
): Promise<void> {
  const span = trace.getActiveSpan();

  if (span) {
    span.setAttributes({
      'job.message_id': messageId,
      'job.type': jobData.type || 'unknown',
      'worker.name': 'worker-jobs',
    });
  }

  logger.info(
    {
      job_data: jobData,
      message_id: messageId,
    },
    'Processing job'
  );

  // Simulate job processing (replace with actual business logic)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Example job processing based on type
  switch (jobData.type) {
    case 'email':
      logger.info({ email_to: jobData.to }, 'Processing email job');
      break;
    case 'notification':
      logger.info(
        { notification_type: jobData.notificationType },
        'Processing notification job'
      );
      break;
    case 'data_processing':
      logger.info({ data_size: jobData.dataSize }, 'Processing data job');
      break;
    default:
      logger.warn({ job_type: jobData.type }, 'Unknown job type');
  }

  logger.info(
    {
      message_id: messageId,
      processing_time: '1000ms',
    },
    'Job completed successfully'
  );
}

// Health check endpoint
server.get('/health', async (request, _reply) => {
  const span = trace.getActiveSpan();
  const activeSpan = span || trace.getSpan(context.active());

  const result = {
    ok: true,
    service: 'worker-jobs',
    timestamp: new Date().toISOString(),
    requestId: request.headers['x-request-id'],
    ...(activeSpan && {
      trace: {
        traceId: activeSpan.spanContext().traceId,
        spanId: activeSpan.spanContext().spanId,
      },
    }),
  };

  request.log.info({ health_check: result }, 'Health check performed');
  return result;
});

// Root endpoint
server.get('/', async (request, _reply) => {
  const reqId = request.headers['x-request-id'];

  return {
    service: 'worker-jobs',
    version: '0.1.0',
    description: 'Cloud Run Job worker for processing Pub/Sub messages',
    time: new Date().toISOString(),
    reqId,
    env: env.NODE_ENV,
  };
});

// Pub/Sub push endpoint (Google Cloud sends messages here)
server.post('/pubsub', async (request, reply) => {
  try {
    // Validate the Pub/Sub message format
    const pubsubMessage = pubsubMessageSchema.parse(request.body);

    // Decode the base64 message data
    const messageData = Buffer.from(
      pubsubMessage.message.data,
      'base64'
    ).toString('utf-8');
    const jobData = JSON.parse(messageData);

    const messageId = pubsubMessage.message.messageId;

    request.log.info(
      {
        message_id: messageId,
        subscription: pubsubMessage.subscription,
        attributes: pubsubMessage.message.attributes,
      },
      'Received Pub/Sub message'
    );

    // Process the job in a traced span
    const tracer = trace.getTracer('worker-jobs', '0.1.0');
    await tracer.startActiveSpan('process-job', async (span) => {
      try {
        await processJob(jobData, messageId, request.log);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });

    // Acknowledge the message (200 response tells Pub/Sub we processed it)
    reply.status(200).send({
      status: 'success',
      messageId,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    request.log.error(
      {
        error: error instanceof Error ? error.message : String(error),
        body: request.body,
      },
      'Error processing Pub/Sub message'
    );

    // Return 400 for client errors (malformed message)
    // Pub/Sub will NOT retry these
    if (error instanceof z.ZodError) {
      reply.status(400).send({
        error: 'Invalid message format',
        details: error.errors,
      });
      return;
    }

    // Return 500 for server errors
    // Pub/Sub WILL retry these
    reply.status(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// E2E test endpoint for tracing
server.get('/v1/trace-test', async (request, _reply) => {
  const span = trace.getActiveSpan();
  const activeSpan = span || trace.getSpan(context.active());

  if (activeSpan) {
    activeSpan.setAttributes({
      'test.type': 'e2e',
      'test.endpoint': '/v1/trace-test',
      'service.name': 'worker-jobs',
    });

    const spanContext = activeSpan.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

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

    request.log.info(
      {
        test_trace: result,
        trace_url: traceUrl,
      },
      `E2E trace test completed - View trace: ${traceUrl}`
    );

    return result;
  }

  // Fallback with manual span
  const tracer = trace.getTracer('worker-jobs', '0.1.0');
  return tracer.startActiveSpan('manual-trace-test', (manualSpan) => {
    const spanContext = manualSpan.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    manualSpan.setAttributes({
      'test.type': 'e2e-manual',
      'test.endpoint': '/v1/trace-test',
      'service.name': 'worker-jobs',
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

// Test endpoint to simulate job processing
server.post('/test-job', async (request, reply) => {
  const jobData = request.body || { type: 'test', message: 'Test job' };
  const messageId = ulid();

  try {
    const tracer = trace.getTracer('worker-jobs', '0.1.0');
    await tracer.startActiveSpan('test-job', async (span) => {
      try {
        await processJob(jobData, messageId, request.log);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });

    reply.status(200).send({
      status: 'success',
      messageId,
      jobData,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    request.log.error({ error }, 'Error processing test job');
    reply.status(500).send({
      error: 'Failed to process test job',
      message: error instanceof Error ? error.message : String(error),
    });
  }
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
    await shutdownOTel();
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
    await server.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    server.log.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        subscription: env.PUBSUB_SUBSCRIPTION,
      },
      'Worker jobs service started successfully'
    );
  } catch (error) {
    server.log.fatal(error, 'Failed to start server');
    process.exit(1);
  }
};

start();
