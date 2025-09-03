/**
 * Correlation utilities for request tracing and logging
 */

import { generateRequestId } from './ids';

/**
 * Extract W3C traceparent header
 */
export const extractTraceparent = (headers: Record<string, string | undefined>): string | undefined => {
  return headers['traceparent'] || headers['x-trace-parent'];
};

/**
 * Generate W3C traceparent header
 */
export const generateTraceparent = (traceId?: string, spanId?: string): string => {
  // W3C Trace Context format: version-traceid-spanid-flags
  const version = '00';
  const finalTraceId = traceId || generateHexId(32);
  const finalSpanId = spanId || generateHexId(16);
  const flags = '01'; // Sampled

  return `${version}-${finalTraceId}-${finalSpanId}-${flags}`;
};

/**
 * Parse W3C traceparent header
 */
export const parseTraceparent = (traceparent: string): {
  version: string;
  traceId: string;
  spanId: string;
  flags: string;
} | null => {
  const parts = traceparent.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, spanId, flags] = parts;
  
  // Validate format
  if (!/^[0-9a-f]{2}$/.test(version) ||
      !/^[0-9a-f]{32}$/.test(traceId) ||
      !/^[0-9a-f]{16}$/.test(spanId) ||
      !/^[0-9a-f]{2}$/.test(flags)) {
    return null;
  }

  return { version, traceId, spanId, flags };
};

/**
 * Create correlation context for logging
 */
export const createCorrelationContext = (
  reqId?: string,
  traceparent?: string,
  tenantId?: string,
  shopId?: string,
  jobId?: string
): Record<string, string> => {
  const context: Record<string, string> = {
    reqId: reqId || generateRequestId(),
  };

  if (traceparent) {
    const parsed = parseTraceparent(traceparent);
    if (parsed) {
      context.traceId = parsed.traceId;
      context.spanId = parsed.spanId;
    }
  }

  if (tenantId) context.tenantId = tenantId;
  if (shopId) context.shopId = shopId;
  if (jobId) context.jobId = jobId;

  return context;
};

/**
 * Extract correlation headers for service-to-service calls
 */
export const extractCorrelationHeaders = (headers: Record<string, string | undefined>): Record<string, string> => {
  const correlationHeaders: Record<string, string> = {};

  // Standard headers to propagate
  const headersToPropagate = [
    'x-request-id',
    'traceparent',
    'tracestate',
    'x-tenant-id',
    'x-shop-id',
    'x-job-id',
    'authorization',
  ];

  headersToPropagate.forEach(header => {
    const value = headers[header] || headers[header.toLowerCase()];
    if (value) {
      correlationHeaders[header] = value;
    }
  });

  return correlationHeaders;
};

/**
 * Generate hex ID for tracing
 */
const generateHexId = (length: number): string => {
  const bytes = Math.ceil(length / 2);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hex.substring(0, length);
};

// Node.js crypto fallback
const crypto = globalThis.crypto || require('crypto').webcrypto;