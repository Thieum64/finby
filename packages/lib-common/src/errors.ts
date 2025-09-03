import { z } from 'zod';

// Error codes enum
export enum ErrorCode {
  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Auth/AuthZ specific
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  
  // Business logic
  SHOP_NOT_CONNECTED = 'SHOP_NOT_CONNECTED',
  REQUEST_IN_PROGRESS = 'REQUEST_IN_PROGRESS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

// Error domains for categorization
export enum ErrorDomain {
  AUTH = 'auth',
  AUTHZ = 'authz',
  SHOPS = 'shops',
  REQUESTS = 'requests',
  BILLING = 'billing',
  SYSTEM = 'system',
}

// Base error class
export class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly domain: ErrorDomain;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly reqId?: string;

  constructor(
    message: string,
    code: ErrorCode,
    domain: ErrorDomain,
    statusCode: number = 500,
    details?: Record<string, any>,
    reqId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.domain = domain;
    this.statusCode = statusCode;
    this.details = details;
    this.reqId = reqId;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      domain: this.domain,
      statusCode: this.statusCode,
      details: this.details,
      reqId: this.reqId,
      timestamp: new Date().toISOString(),
    };
  }
}

// Specific error classes
export class ValidationError extends BaseError {
  constructor(message: string, details?: Record<string, any>, reqId?: string) {
    super(message, ErrorCode.VALIDATION_ERROR, ErrorDomain.SYSTEM, 400, details, reqId);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, reqId?: string) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, ErrorDomain.SYSTEM, 404, undefined, reqId);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized', reqId?: string) {
    super(message, ErrorCode.UNAUTHORIZED, ErrorDomain.AUTH, 401, undefined, reqId);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden', reqId?: string) {
    super(message, ErrorCode.FORBIDDEN, ErrorDomain.AUTHZ, 403, undefined, reqId);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, reqId?: string) {
    super(message, ErrorCode.RATE_LIMITED, ErrorDomain.SYSTEM, 429, { retryAfter }, reqId);
  }
}

// Zod validation error converter
export const formatZodError = (error: z.ZodError, reqId?: string): ValidationError => {
  const details = error.errors.reduce((acc, err) => {
    const path = err.path.join('.');
    acc[path] = err.message;
    return acc;
  }, {} as Record<string, string>);

  return new ValidationError('Validation failed', details, reqId);
};