// Re-export types from OpenAPI contract
import type { components } from '../../contracts/clients/authz.js';

export type UserContext = components['schemas']['UserContext'];
export type Role = components['schemas']['Role'];
export type Ulid = components['schemas']['Ulid'];
export type TenantRole = components['schemas']['TenantRole'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

// Request/Response types for convenience
export interface CreateTenantPayload {
  name: string;
}

export interface CreateTenantResponse {
  tenantId: Ulid;
}

export interface CreateInvitationPayload {
  tenantId: Ulid;
  email: string;
  role: Role;
}

export interface CreateInvitationResponse {
  token: string;
  tenantId: Ulid;
  expiresAt: string;
}

export interface InvitationDetails {
  tenantId: Ulid;
  email: string;
  role: Role;
  status: 'PENDING';
  expiresAt: string;
}

export interface AcceptInvitationResponse {
  tenantId: Ulid;
  roles: Role[];
}

export interface TenantRolesResponse {
  tenantId: Ulid;
  roles: Role[];
}

export interface HealthResponse {
  ok: boolean;
  service: 'svc-authz';
  version: string;
}
