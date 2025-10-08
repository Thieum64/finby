import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, _reply) => {
    return {
      ok: true,
      service: 'svc-authz',
      version: process.env.npm_package_version ?? 'dev',
      authProvider: 'firebase',
      projectId: process.env.FIREBASE_PROJECT_ID ?? 'unknown',
    };
  });

  // Debug endpoint for testing token verification
  fastify.get(
    '/_debug/verify',
    {
      preHandler: fastify.verifyAuth,
    },
    async (request, _reply) => {
      return {
        uid: request.user?.uid,
        email: request.user?.email,
      };
    }
  );
};

export default healthRoutes;
