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

      const tenants = await membershipsRepo.listTenantsByUid(request.user.uid);

      return {
        uid: request.user.uid,
        email: request.user.email || '',
        tenants,
      };
    }
  );
};

export default meRoutes;
