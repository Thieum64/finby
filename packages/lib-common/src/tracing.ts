export function extractReqId(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const xReqId = headers['x-request-id'];
  if (typeof xReqId === 'string') {
    return xReqId;
  }
  if (Array.isArray(xReqId) && xReqId.length > 0) {
    return xReqId[0];
  }

  const traceparent = headers['traceparent'];
  if (typeof traceparent === 'string') {
    const parts = traceparent.split('-');
    if (parts.length >= 2) {
      return parts[1];
    }
  }
  if (Array.isArray(traceparent) && traceparent.length > 0) {
    const parts = traceparent[0].split('-');
    if (parts.length >= 2) {
      return parts[1];
    }
  }

  return undefined;
}

export function withReqId<T>(reqId: string, fn: () => T): T {
  return fn();
}
