export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'CANCELED';

export interface Invitation {
  token: string;
  tenantId: string;
  email: string;
  role: 'Owner' | 'Collaborator' | 'PlatformAdmin';
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
}
