export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      obj.details = this.details;
    }
    if (process.env.NODE_ENV !== 'production' && this.stack) {
      obj.stack = this.stack;
    }
    return obj;
  }
}

export function unauthorized(
  message = 'Unauthorized',
  details?: unknown
): AppError {
  return new AppError('UNAUTHORIZED', message, 401, details);
}

export function forbidden(message = 'Forbidden', details?: unknown): AppError {
  return new AppError('FORBIDDEN', message, 403, details);
}

export function notFound(message = 'Not found', details?: unknown): AppError {
  return new AppError('NOT_FOUND', message, 404, details);
}

export function conflict(message = 'Conflict', details?: unknown): AppError {
  return new AppError('CONFLICT', message, 409, details);
}

export function invalidArgument(
  message = 'Invalid argument',
  details?: unknown
): AppError {
  return new AppError('INVALID_ARGUMENT', message, 400, details);
}

export function preconditionFailed(
  message = 'Precondition failed',
  details?: unknown
): AppError {
  return new AppError('PRECONDITION_FAILED', message, 412, details);
}

export function rateLimited(
  message = 'Rate limit exceeded',
  details?: unknown
): AppError {
  return new AppError('RATE_LIMITED', message, 429, details);
}

export function internal(
  message = 'Internal server error',
  details?: unknown
): AppError {
  return new AppError('INTERNAL', message, 500, details);
}
