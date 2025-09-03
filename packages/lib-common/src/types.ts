import { z } from 'zod';

// Base entity schema with common fields
export const BaseEntitySchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().default(1),
});

// Multi-tenant base schema
export const TenantEntitySchema = BaseEntitySchema.extend({
  tenantId: z.string(),
});

// Common ID patterns
export const UlidSchema = z.string().regex(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/, 'Invalid ULID format');
export const RequestIdSchema = z.string().regex(/^req_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/, 'Invalid request ID format');
export const JobIdSchema = z.string().regex(/^job_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/, 'Invalid job ID format');
export const TenantIdSchema = z.string().regex(/^ten_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/, 'Invalid tenant ID format');
export const ShopIdSchema = z.string().regex(/^shop_[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/, 'Invalid shop ID format');

// User roles
export enum UserRole {
  PLATFORM_ADMIN = 'platform_admin',
  TENANT_OWNER = 'tenant_owner',
  TENANT_COLLABORATOR = 'tenant_collaborator',
}

// Request context for multi-tenancy
export const RequestContextSchema = z.object({
  reqId: RequestIdSchema,
  traceId: z.string().optional(),
  userId: z.string().optional(),
  tenantId: TenantIdSchema.optional(),
  shopId: ShopIdSchema.optional(),
  roles: z.array(z.nativeEnum(UserRole)).default([]),
  timestamp: z.date().default(() => new Date()),
});

export type RequestContext = z.infer<typeof RequestContextSchema>;

// Common API response schemas
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  reqId: z.string(),
  timestamp: z.date(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    domain: z.string(),
    details: z.record(z.any()).optional(),
  }),
  reqId: z.string(),
  timestamp: z.date(),
});

export type SuccessResponse<T = any> = {
  success: true;
  data: T;
  reqId: string;
  timestamp: Date;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    domain: string;
    details?: Record<string, any>;
  };
  reqId: string;
  timestamp: Date;
};

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Pagination
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const PaginatedResponseSchema = z.object({
  items: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export type Pagination = z.infer<typeof PaginationSchema>;
export type PaginatedResponse<T = any> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};