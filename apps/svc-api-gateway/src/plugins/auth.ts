import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyIdToken, TokenPayload } from '../auth/firebase';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }

  interface FastifyInstance {
    requireAuth: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    attachUserIfPresent: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

// Utility to validate ULID format
export function isUlid(str: string): boolean {
  const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  return ULID_REGEX.test(str);
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Strict preHandler: requires valid token, throws 401 if missing/invalid
  fastify.decorate(
    'requireAuth',
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

  // Optional preHandler: attaches user if token present, returns 401 on invalid token
  fastify.decorate(
    'attachUserIfPresent',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return;
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

  // Add global hook for optional user attachment (can be overridden per route)
  fastify.addHook('onRequest', async (request, reply) => {
    // Exempt public routes from auth
    const publicRoutes = [
      '/api/v1/status',
      '/api/v1/auth/health',
      '/health',
      '/',
    ];
    const isPublic = publicRoutes.some((route) =>
      request.url.startsWith(route)
    );

    if (isPublic) {
      return;
    }

    await fastify.attachUserIfPresent(request, reply);
  });
};

export default fp(authPlugin, {
  name: 'auth-plugin',
});
