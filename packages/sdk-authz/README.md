# @hp/sdk-authz

TypeScript client for Hyperush AuthZ service providing tenant and membership management.

## Installation

```bash
npm install @hp/sdk-authz
# or
pnpm add @hp/sdk-authz
```

## Usage

```typescript
import { AuthZClient } from '@hp/sdk-authz';

// Create client instance
const client = new AuthZClient({
  baseUrl: 'https://api.hyperush.dev',
  getToken: async () => 'your-firebase-jwt-token',
});

// Health check (public, no auth required)
const health = await client.health();
console.log(health); // { ok: true, service: 'svc-authz', version: '0.1.0' }

// Get current user context
const user = await client.me();
console.log(user); // { uid: '...', email: '...', tenants: [...] }

// Create a new tenant
const tenant = await client.createTenant(
  { name: 'My Organization' },
  { idempotencyKey: 'unique-key-123' }
);
console.log(tenant); // { tenantId: '01HZZZZZZZZZZZZZZZZZZZZZZ' }

// Check tenant access (returns boolean)
const hasAccess = await client.checkTenantAccess('01HZZZZZZZZZZZZZZZZZZZZZZ');
console.log(hasAccess); // true or false

// Get user roles for a tenant
const roles = await client.getTenantRoles('01HZZZZZZZZZZZZZZZZZZZZZZ');
console.log(roles); // { tenantId: '...', roles: ['Owner'] }

// Create invitation
const invitation = await client.createInvitation(
  {
    tenantId: '01HZZZZZZZZZZZZZZZZZZZZZZ',
    email: 'user@example.com',
    role: 'Collaborator',
  },
  { idempotencyKey: 'invite-key-456' }
);
console.log(invitation); // { token: '...', tenantId: '...', expiresAt: '...' }

// Get invitation details (public)
const details = await client.getInvitation('invitation-token');
console.log(details); // { tenantId: '...', email: '...', role: '...', status: 'PENDING', expiresAt: '...' }

// Accept invitation
const result = await client.acceptInvitation('invitation-token', {
  idempotencyKey: 'accept-key-789',
});
console.log(result); // { tenantId: '...', roles: ['Collaborator'] }

// Cancel invitation
await client.cancelInvitation('invitation-token');
```

## API Methods

| Method                             | Endpoint                                       | Auth Required | Idempotent |
| ---------------------------------- | ---------------------------------------------- | ------------- | ---------- |
| `health()`                         | `GET /api/v1/auth/health`                      | No            | -          |
| `me()`                             | `GET /api/v1/auth/me`                          | Yes           | -          |
| `createTenant(payload, opts?)`     | `POST /api/v1/auth/tenants`                    | Yes           | Yes        |
| `checkTenantAccess(tenantId?)`     | `HEAD /api/v1/auth/tenants/{id}/access`        | Yes           | -          |
| `getTenantRoles(tenantId?)`        | `GET /api/v1/auth/tenants/{id}/roles`          | Yes           | -          |
| `createInvitation(payload, opts?)` | `POST /api/v1/auth/invitations`                | Yes           | Yes        |
| `getInvitation(token)`             | `GET /api/v1/auth/invitations/{token}`         | No            | -          |
| `acceptInvitation(token, opts?)`   | `POST /api/v1/auth/invitations/{token}/accept` | Yes           | Yes        |
| `cancelInvitation(token)`          | `DELETE /api/v1/auth/invitations/{token}`      | Yes           | -          |

## HTTP Headers

The client automatically manages the following headers:

| Header              | Purpose                        | Auto-Generated               |
| ------------------- | ------------------------------ | ---------------------------- |
| `authorization`     | Bearer token from `getToken()` | Yes (if token available)     |
| `x-request-id`      | Request tracing (ULID format)  | Yes (always)                 |
| `x-idempotency-key` | Safe retries for mutations     | No (opt-in via `opts`)       |
| `x-tenant-id`       | Tenant context                 | No (reserved for future use) |
| `content-type`      | JSON payload indicator         | Yes (when body present)      |

## Error Handling

All methods throw `AuthZClientError` for non-2xx responses:

```typescript
import { AuthZClient, AuthZClientError } from '@hp/sdk-authz';

const client = new AuthZClient({ baseUrl: 'https://api.hyperush.dev' });

try {
  await client.checkTenantAccess('invalid-tenant-id');
} catch (error) {
  if (error instanceof AuthZClientError) {
    console.error(`Status: ${error.status}`);
    console.error(`Body:`, error.body);
    console.error(`Message: ${error.message}`);
  }
}
```

## Configuration Options

```typescript
interface AuthZClientOptions {
  /** Base URL for the AuthZ service (e.g., https://api.hyperush.dev) */
  baseUrl: string;

  /** Optional function to get the authentication token */
  getToken?: () => Promise<string | undefined>;

  /** Optional fetch implementation (defaults to globalThis.fetch) */
  fetchImpl?: typeof fetch;

  /** Optional default tenant ID for tenant-scoped requests */
  defaultTenantId?: string;
}
```

## Types

All TypeScript types are exported from the package and match the OpenAPI specification:

```typescript
import type {
  UserContext,
  Role,
  Ulid,
  TenantRole,
  CreateTenantPayload,
  CreateInvitationPayload,
  // ... and more
} from '@hp/sdk-authz';
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## License

Internal package for Hyperush organization.
