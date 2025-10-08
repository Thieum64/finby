import { FastifyPluginAsync } from 'fastify';
import { MembershipsRepo } from '../repos/index.js';

const meRoutes: FastifyPluginAsync = async (fastify) => {
  const membershipsRepo = new MembershipsRepo();

  fastify.get(
    '/me',
    {
      preHandler: fastify.verifyAuth,
    },
    async (request, _reply) => {
      if (!request.user) {
        return _reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      if (!request.user.email) {
        request.log.warn(
          {
            reqId: request.headers['x-request-id'],
            uid: request.user.uid,
          },
          'Missing email on token'
        );
        return _reply.status(400).send({
          code: 'INVALID_ARGUMENT',
          message: 'Missing email on token',
        });
      }

      const tenants = await membershipsRepo.listTenantsByUid(request.user.uid);

      return {
        uid: request.user.uid,
        email: request.user.email,
        tenants,
      };
    }
  );
};

export default meRoutes;
