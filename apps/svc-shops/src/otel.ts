import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';

let sdk: NodeSDK | null = null;

export function initOTel(serviceName: string): void {
  if (sdk) {
    console.warn(
      `OpenTelemetry already initialized for service: ${serviceName}`
    );
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    console.info(
      `Skipping OpenTelemetry initialization in test environment for service: ${serviceName}`
    );
    return;
  }

  try {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]:
        process.env.SERVICE_VERSION || '0.1.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || 'development',
    });

    const traceExporter = new TraceExporter({
      projectId: process.env.GCP_PROJECT_ID,
    });

    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-dns': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-net': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
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

    sdk.start();

    console.info(
      `OpenTelemetry initialized successfully for service: ${serviceName}`
    );

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
  }
}

export { trace, context } from '@opentelemetry/api';
