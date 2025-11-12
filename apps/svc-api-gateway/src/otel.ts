import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';

let sdk: NodeSDK | null = null;

export function initOTel(serviceName: string): void {
  // Prevent multiple initializations
  if (sdk) {
    console.warn(
      `OpenTelemetry already initialized for service: ${serviceName}`
    );
    return;
  }

  // Don't initialize if ENABLE_OTEL is explicitly set to false
  if (process.env.ENABLE_OTEL === 'false') {
    console.info(
      `OpenTelemetry disabled via ENABLE_OTEL=false for service: ${serviceName}`
    );
    return;
  }

  // Don't initialize in test environment
  if (process.env.NODE_ENV === 'test') {
    console.info(
      `Skipping OpenTelemetry initialization in test environment for service: ${serviceName}`
    );
    return;
  }

  try {
    // Configure resource attributes
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.SERVICE_VERSION || '0.1.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || 'development',
    });

    // Configure trace exporter for Cloud Trace
    const traceExporter = new TraceExporter({
      projectId: process.env.GCP_PROJECT_ID,
    });

    // Initialize the SDK
    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable specific instrumentations if needed
          '@opentelemetry/instrumentation-dns': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-net': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          // Enable HTTP and Fastify instrumentations
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-fastify': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pino': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    console.info(
      `OpenTelemetry initialized successfully for service: ${serviceName}`
    );

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      try {
        await sdk?.shutdown();
        console.info('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        console.error('Error shutting down OpenTelemetry SDK:', error);
      }
    });
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
    // Don't throw - let the service continue without tracing
  }
}

// Export trace API for manual instrumentation if needed
export { trace, context } from '@opentelemetry/api';
