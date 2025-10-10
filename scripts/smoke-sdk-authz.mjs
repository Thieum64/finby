#!/usr/bin/env node
/**
 * Smoke test for @hp/sdk-authz client
 * Tests SDK methods against the AuthZ service (via gateway or direct)
 *
 * Environment variables:
 * - GATEWAY_URL: API Gateway base URL (default: http://localhost:8080)
 * - JWT: Firebase Auth JWT token for authenticated requests (optional)
 * - TENANT_ID: ULID of a tenant to test access (optional)
 */

import { AuthZClient } from '../packages/sdk-authz/dist/index.js';

// Configuration from environment
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
const JWT = process.env.JWT;
const TENANT_ID = process.env.TENANT_ID;

console.log('======================================');
console.log('SDK AuthZ Smoke Test');
console.log('======================================');
console.log(`Gateway URL: ${GATEWAY_URL}`);
console.log(`JWT: ${JWT ? 'PROVIDED' : 'NOT PROVIDED (public only)'}`);
console.log(`Tenant ID: ${TENANT_ID || 'NOT PROVIDED'}`);
console.log('');

// Create client
const client = new AuthZClient({
  baseUrl: GATEWAY_URL,
  getToken: async () => JWT,
});

let exitCode = 0;

// Test 1: Health check (public)
console.log('[1/4] Testing health() - GET /api/v1/auth/health (public)...');
try {
  const health = await client.health();
  if (health.ok && health.service === 'svc-authz') {
    console.log(`✓ Health OK - service: ${health.service}, version: ${health.version}`);
  } else {
    console.error('✗ Health check returned unexpected response:', health);
    exitCode = 1;
  }
} catch (error) {
  console.error(`✗ Health check failed:`, error.message);
  if (error.status) {
    console.error(`  Status: ${error.status}`);
    console.error(`  Body:`, error.body);
  }
  exitCode = 1;
}

console.log('');

// Test 2: Get current user context (authenticated)
if (JWT) {
  console.log('[2/4] Testing me() - GET /api/v1/auth/me (authenticated)...');
  try {
    const user = await client.me();
    if (user.uid && user.email) {
      console.log(`✓ User context OK - uid: ${user.uid}, email: ${user.email}, tenants: ${user.tenants.length}`);
    } else {
      console.error('✗ User context returned unexpected response:', user);
      exitCode = 1;
    }
  } catch (error) {
    console.error(`✗ Get user context failed:`, error.message);
    if (error.status) {
      console.error(`  Status: ${error.status}`);
      console.error(`  Body:`, error.body);
    }
    exitCode = 1;
  }
} else {
  console.log('[2/4] Skipping me() - JWT not provided');
}

console.log('');

// Test 3: Check tenant access (authenticated, requires tenant ID)
if (JWT && TENANT_ID) {
  console.log(`[3/4] Testing checkTenantAccess() - HEAD /api/v1/auth/tenants/${TENANT_ID}/access...`);
  try {
    const hasAccess = await client.checkTenantAccess(TENANT_ID);
    console.log(`✓ Tenant access check OK - hasAccess: ${hasAccess}`);
  } catch (error) {
    console.error(`✗ Tenant access check failed:`, error.message);
    if (error.status) {
      console.error(`  Status: ${error.status}`);
      console.error(`  Body:`, error.body);
    }
    exitCode = 1;
  }
} else {
  console.log('[3/4] Skipping checkTenantAccess() - JWT or TENANT_ID not provided');
}

console.log('');

// Test 4: Get tenant roles (authenticated, requires tenant ID)
if (JWT && TENANT_ID) {
  console.log(`[4/4] Testing getTenantRoles() - GET /api/v1/auth/tenants/${TENANT_ID}/roles...`);
  try {
    const roles = await client.getTenantRoles(TENANT_ID);
    if (roles.tenantId && Array.isArray(roles.roles)) {
      console.log(`✓ Tenant roles OK - tenantId: ${roles.tenantId}, roles: [${roles.roles.join(', ')}]`);
    } else {
      console.error('✗ Tenant roles returned unexpected response:', roles);
      exitCode = 1;
    }
  } catch (error) {
    console.error(`✗ Get tenant roles failed:`, error.message);
    if (error.status) {
      console.error(`  Status: ${error.status}`);
      console.error(`  Body:`, error.body);
    }
    exitCode = 1;
  }
} else {
  console.log('[4/4] Skipping getTenantRoles() - JWT or TENANT_ID not provided');
}

console.log('');
console.log('======================================');
if (exitCode === 0) {
  console.log('✓ All smoke tests passed!');
} else {
  console.log('✗ Some smoke tests failed');
}
console.log('======================================');

process.exit(exitCode);
