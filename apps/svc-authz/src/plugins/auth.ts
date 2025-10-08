import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyIdToken, TokenPayload } from '../auth/firebase';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }

  interface FastifyInstance {
    verifyAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    attachUserIfPresent: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Strict preHandler: requires valid token, throws 401 if missing/invalid
  fastify.decorate(
    'verifyAuth',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Authorization header required',
        });
      }

      try {
        const user = await verifyIdToken(authHeader);
        request.user = user;
      } catch (error) {
        request.log.warn({ error }, 'Token verification failed');
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }
    }
  );

  // Optional preHandler: attaches user if token present, doesn't throw
  fastify.decorate(
    'attachUserIfPresent',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return;
      }

      try {
        const user = await verifyIdToken(authHeader);
        request.user = user;
      } catch (error) {
        request.log.debug(
          { error },
          'Optional token verification failed (ignored)'
        );
        // Silently ignore - user remains undefined
      }
    }
  );

  // Add global hook for optional user attachment (can be overridden per route)
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.attachUserIfPresent(request, reply);
  });
};

export default fp(authPlugin, {
  name: 'auth-plugin',
});
