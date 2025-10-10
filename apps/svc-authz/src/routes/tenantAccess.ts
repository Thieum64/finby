import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TenantsRepo, MembershipsRepo } from '../repos/index.js';

// ULID validation regex
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const tenantIdSchema = z.string().regex(ULID_REGEX, 'Invalid ULID format');

const tenantAccessRoutes: FastifyPluginAsync = async (fastify) => {
  const tenantsRepo = new TenantsRepo();
  const membershipsRepo = new MembershipsRepo();

  // HEAD /tenants/:tenantId/access
  fastify.head(
    '/tenants/:tenantId/access',
    {
      preHandler: fastify.verifyAuth,
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Validate tenantId
      const parseResult = tenantIdSchema.safeParse(
        (request.params as { tenantId: string }).tenantId
      );

      if (!parseResult.success) {
        request.log.warn(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
            tenantId: (request.params as { tenantId: string }).tenantId,
            action: 'access',
            outcome: 'invalid_id',
          },
          'Invalid tenantId format'
        );
        return reply.status(400).send({
          code: 'INVALID_ARGUMENT',
          message: 'Invalid tenantId format',
        });
      }

      const tenantId = parseResult.data;

      // Check if tenant exists
      const tenant = await tenantsRepo.get(tenantId);
      if (!tenant) {
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
            tenantId,
            action: 'access',
            outcome: 'not_found',
          },
          'Tenant not found'
        );
        return reply.status(404).send();
      }

      // Check access
      const hasAccess = await membershipsRepo.hasAccess(
        tenantId,
        request.user.uid
      );

      if (!hasAccess) {
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
            tenantId,
            action: 'access',
            outcome: 'deny',
          },
          'Access denied'
        );
        return reply.status(403).send();
      }

      request.log.info(
        {
          reqId: request.headers['x-request-id'],
          uid: request.user.uid,
          tenantId,
          action: 'access',
          outcome: 'allow',
        },
        'Access granted'
      );
      return reply.status(200).send();
    }
  );

  // GET /tenants/:tenantId/roles
  fastify.get(
    '/tenants/:tenantId/roles',
    {
      preHandler: fastify.verifyAuth,
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Validate tenantId
      const parseResult = tenantIdSchema.safeParse(
        (request.params as { tenantId: string }).tenantId
      );

      if (!parseResult.success) {
        request.log.warn(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
            tenantId: (request.params as { tenantId: string }).tenantId,
            action: 'roles',
            outcome: 'invalid_id',
          },
          'Invalid tenantId format'
        );
        return reply.status(400).send({
          code: 'INVALID_ARGUMENT',
          message: 'Invalid tenantId format',
        });
      }

      const tenantId = parseResult.data;

      // Check if tenant exists
      const tenant = await tenantsRepo.get(tenantId);
      if (!tenant) {
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
            tenantId,
            action: 'roles',
            outcome: 'not_found',
          },
          'Tenant not found'
        );
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      // Get roles
      const roles = await membershipsRepo.getRoles(tenantId, request.user.uid);

      if (!roles || roles.length === 0) {
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
            tenantId,
            action: 'roles',
            outcome: 'deny',
          },
          'User is not a member'
        );
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'User is not a member of this tenant',
        });
      }

      request.log.info(
        {
          reqId: request.headers['x-request-id'],
          uid: request.user.uid,
          tenantId,
          action: 'roles',
          outcome: 'allow',
          rolesCount: roles.length,
        },
        'Roles retrieved'
      );

      return reply.status(200).send({
        tenantId,
        roles,
      });
    }
  );
};

export default tenantAccessRoutes;
