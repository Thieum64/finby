import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | null = null;

export function initOTel(serviceName: string): void {
  if (sdk) {
    console.log('OpenTelemetry already initialized');
    return;

  // Don't initialize if ENABLE_OTEL is explicitly set to false
  if (process.env.ENABLE_OTEL === 'false') {
    console.info(
      `OpenTelemetry disabled via ENABLE_OTEL=false for service: ${serviceName}`
    );
    return;
  }
  }

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
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
      }),
    ],
  });

  try {
    sdk.start();
    console.log(
      'OpenTelemetry initialized successfully for service:',
      serviceName
    );
  } catch (error) {
    console.error('Error initializing OpenTelemetry:', error);
  }
}

export function shutdownOTel(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}
