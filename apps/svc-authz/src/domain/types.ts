export type Ulid = string;

export type Role = 'Owner' | 'Collaborator' | 'PlatformAdmin';

export interface Tenant {
  tenantId: Ulid;
  name: string;
  createdAt: string;
  ownerUid: string;
}

export interface Membership {
  tenantId: Ulid;
  uid: string;
  roles: Role[];
  createdAt: string;
}

export interface User {
  uid: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
}
