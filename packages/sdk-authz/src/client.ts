import { ulid } from 'ulid';
import type {
  UserContext,
  Ulid,
  CreateTenantPayload,
  CreateTenantResponse,
  CreateInvitationPayload,
  CreateInvitationResponse,
  InvitationDetails,
  AcceptInvitationResponse,
  TenantRolesResponse,
  HealthResponse,
  ErrorResponse,
} from './types.js';

export interface AuthZClientOptions {
  /** Base URL for the AuthZ service (e.g., https://svc-authz-... or https://api-gateway-...) */
  baseUrl: string;
  /** Optional function to get the authentication token */
  getToken?: () => Promise<string | undefined>;
  /** Optional fetch implementation (defaults to globalThis.fetch) */
  fetchImpl?: typeof fetch;
  /** Optional default tenant ID for tenant-scoped requests */
  defaultTenantId?: Ulid;
}

export interface RequestOptions {
  body?: unknown;
  idempotencyKey?: string;
  tenantId?: Ulid;
}

export class AuthZClientError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string
  ) {
    super(message || `AuthZ request failed with status ${status}`);
    this.name = 'AuthZClientError';
  }
}

export class AuthZClient {
  private readonly baseUrl: string;
  private readonly getToken?: () => Promise<string | undefined>;
  private readonly fetch: typeof fetch;
  private readonly defaultTenantId?: Ulid;

  constructor(opts: AuthZClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.getToken = opts.getToken;
    this.fetch = opts.fetchImpl || globalThis.fetch;
    this.defaultTenantId = opts.defaultTenantId;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'HEAD' | 'DELETE',
    path: string,
    opts?: RequestOptions
  ): Promise<{ status: number; data?: T }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'x-request-id': ulid(),
    };

    // Add authorization header if token is available
    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['authorization'] = `Bearer ${token}`;
      }
    }

    // Add content-type for JSON bodies
    if (opts?.body) {
      headers['content-type'] = 'application/json';
    }

    // Add idempotency key if provided
    if (opts?.idempotencyKey) {
      headers['x-idempotency-key'] = opts.idempotencyKey;
    }

    // Add tenant ID header if provided
    if (opts?.tenantId) {
      headers['x-tenant-id'] = opts.tenantId;
    }

    const response = await this.fetch(url, {
      method,
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });

    // For HEAD requests, just return status
    if (method === 'HEAD') {
      return { status: response.status };
    }

    // For 2xx responses, parse JSON if present
    if (response.status >= 200 && response.status < 300) {
      // 204 No Content has no body
      if (response.status === 204) {
        return { status: response.status };
      }

      const data = await response.json();
      return { status: response.status, data: data as T };
    }

    // For non-2xx responses, throw error with status and body
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    const errorMessage =
      typeof errorBody === 'object' &&
      errorBody !== null &&
      'message' in errorBody
        ? String((errorBody as ErrorResponse).message)
        : `Request failed with status ${response.status}`;

    throw new AuthZClientError(response.status, errorBody, errorMessage);
  }

  // ==================== Health ====================

  /**
   * Health check endpoint (public, no auth required)
   * GET /api/v1/auth/health
   */
  async health(): Promise<HealthResponse> {
    const { data } = await this.request<HealthResponse>(
      'GET',
      '/api/v1/auth/health'
    );
    if (!data) {
      throw new Error('Health check returned no data');
    }
    return data;
  }

  // ==================== User Context ====================

  /**
   * Get current user context (requires auth)
   * GET /api/v1/auth/me
   */
  async me(): Promise<UserContext> {
    const { data } = await this.request<UserContext>('GET', '/api/v1/auth/me');
    if (!data) {
      throw new Error('Me endpoint returned no data');
    }
    return data;
  }

  // ==================== Tenants ====================

  /**
   * Create a new tenant (requires auth)
   * POST /api/v1/auth/tenants
   */
  async createTenant(
    payload: CreateTenantPayload,
    opts?: { idempotencyKey?: string }
  ): Promise<CreateTenantResponse> {
    const { data } = await this.request<CreateTenantResponse>(
      'POST',
      '/api/v1/auth/tenants',
      {
        body: payload,
        idempotencyKey: opts?.idempotencyKey,
      }
    );
    if (!data) {
      throw new Error('Create tenant returned no data');
    }
    return data;
  }

  /**
   * Check if user has access to tenant (requires auth)
   * HEAD /api/v1/auth/tenants/{tenantId}/access
   * Returns true for 200, false for 403/404
   */
  async checkTenantAccess(tenantId?: Ulid): Promise<boolean> {
    const tid = tenantId || this.defaultTenantId;
    if (!tid) {
      throw new Error(
        'tenantId is required (provide via argument or defaultTenantId)'
      );
    }

    try {
      const { status } = await this.request(
        'HEAD',
        `/api/v1/auth/tenants/${tid}/access`
      );
      return status === 200;
    } catch (error) {
      if (
        error instanceof AuthZClientError &&
        (error.status === 403 || error.status === 404)
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get user roles for a specific tenant (requires auth)
   * GET /api/v1/auth/tenants/{tenantId}/roles
   */
  async getTenantRoles(tenantId?: Ulid): Promise<TenantRolesResponse> {
    const tid = tenantId || this.defaultTenantId;
    if (!tid) {
      throw new Error(
        'tenantId is required (provide via argument or defaultTenantId)'
      );
    }

    const { data } = await this.request<TenantRolesResponse>(
      'GET',
      `/api/v1/auth/tenants/${tid}/roles`
    );
    if (!data) {
      throw new Error('Get tenant roles returned no data');
    }
    return data;
  }

  // ==================== Invitations ====================

  /**
   * Create a new tenant invitation (requires auth, Owner role)
   * POST /api/v1/auth/invitations
   */
  async createInvitation(
    payload: CreateInvitationPayload,
    opts?: { idempotencyKey?: string }
  ): Promise<CreateInvitationResponse> {
    const { data } = await this.request<CreateInvitationResponse>(
      'POST',
      '/api/v1/auth/invitations',
      {
        body: payload,
        idempotencyKey: opts?.idempotencyKey,
      }
    );
    if (!data) {
      throw new Error('Create invitation returned no data');
    }
    return data;
  }

  /**
   * Get invitation details (public, no auth required)
   * GET /api/v1/auth/invitations/{token}
   */
  async getInvitation(token: string): Promise<InvitationDetails> {
    const { data } = await this.request<InvitationDetails>(
      'GET',
      `/api/v1/auth/invitations/${token}`
    );
    if (!data) {
      throw new Error('Get invitation returned no data');
    }
    return data;
  }

  /**
   * Accept a tenant invitation (requires auth)
   * POST /api/v1/auth/invitations/{token}/accept
   */
  async acceptInvitation(
    token: string,
    opts?: { idempotencyKey?: string }
  ): Promise<AcceptInvitationResponse> {
    const { data } = await this.request<AcceptInvitationResponse>(
      'POST',
      `/api/v1/auth/invitations/${token}/accept`,
      {
        idempotencyKey: opts?.idempotencyKey,
      }
    );
    if (!data) {
      throw new Error('Accept invitation returned no data');
    }
    return data;
  }

  /**
   * Cancel an invitation (requires auth, Owner role)
   * DELETE /api/v1/auth/invitations/{token}
   */
  async cancelInvitation(token: string): Promise<void> {
    await this.request('DELETE', `/api/v1/auth/invitations/${token}`);
  }
}
