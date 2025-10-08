import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ulid } from 'ulid';
import { validateIdempotencyKey } from '@hp/lib-common';
import { TenantsRepo, MembershipsRepo } from '../repos/index.js';
import { IDEMPOTENCY_HEADER, withIdempotency } from '../data/idempotency.js';

const createTenantSchema = z.object({
  name: z.string().min(2).max(64),
});

const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  const tenantsRepo = new TenantsRepo();
  const membershipsRepo = new MembershipsRepo();

  fastify.post(
    '/tenants',
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

      // Validate idempotency key
      const idempotencyKey = request.headers[IDEMPOTENCY_HEADER] as
        | string
        | undefined;

      if (!idempotencyKey) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: `Header ${IDEMPOTENCY_HEADER} is required`,
        });
      }

      if (!validateIdempotencyKey(idempotencyKey)) {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: `Invalid ${IDEMPOTENCY_HEADER}: must be 10-64 alphanumeric/._~- characters`,
        });
      }

      // Validate request body
      const parseResult = createTenantSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          errors: parseResult.error.errors,
        });
      }

      const { name } = parseResult.data;
      const uid = request.user.uid;

      // Execute with idempotency
      const { fromCache, result } = await withIdempotency(
        idempotencyKey,
        uid,
        async () => {
          const tenantId = ulid();
          const createdAt = new Date().toISOString();

          await tenantsRepo.set({
            tenantId,
            name,
            createdAt,
            ownerUid: uid,
          });

          await membershipsRepo.set({
            tenantId,
            uid,
            roles: ['Owner'],
            createdAt,
          });

          return { tenantId };
        }
      );

      // Log structured
      request.log.info(
        {
          reqId: request.headers['x-request-id'],
          uid,
          tenantId: result.tenantId,
          idempotent: fromCache,
        },
        `Tenant ${fromCache ? 'retrieved from cache' : 'created'}`
      );

      // Return 200 if from cache, 201 if newly created
      const statusCode = fromCache ? 200 : 201;
      return reply.status(statusCode).send(result);
    }
  );
};

export default tenantsRoutes;
