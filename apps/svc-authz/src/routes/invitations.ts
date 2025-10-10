import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { validateIdempotencyKey } from '@hp/lib-common';
import {
  TenantsRepo,
  MembershipsRepo,
  InvitationsRepo,
} from '../repos/index.js';
import {
  IDEMPOTENCY_HEADER,
  withIdempotency,
  IdempotencyConflictError,
} from '../data/idempotency.js';
import { Invitation } from '../domain/invitations.js';
import { env } from '../index.js';

const createInvitationSchema = z.object({
  tenantId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Invalid ULID format'),
  email: z.string().email(),
  role: z.enum(['Owner', 'Collaborator', 'PlatformAdmin']),
});

const INVITATION_VALIDITY_DAYS = 7;

const invitationsRoutes: FastifyPluginAsync = async (fastify) => {
  const tenantsRepo = new TenantsRepo();
  const membershipsRepo = new MembershipsRepo();
  const invitationsRepo = new InvitationsRepo();

  // POST /invitations - Create invitation
  fastify.post(
    '/invitations',
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
          message: `Invalid ${IDEMPOTENCY_HEADER}`,
        });
      }

      // Validate request body
      const parseResult = createInvitationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          errors: parseResult.error.errors,
        });
      }

      const { tenantId, email, role } = parseResult.data;
      const uid = request.user.uid;

      // Check if tenant exists
      const tenant = await tenantsRepo.get(tenantId);
      if (!tenant) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      // Check if user is Owner of the tenant (RBAC)
      const membership = await membershipsRepo.get(tenantId, uid);
      if (!membership || !membership.roles.includes('Owner')) {
        request.log.warn(
          {
            reqId: request.headers['x-request-id'],
            uid,
            tenantId,
            action: 'create_invitation',
            outcome: 'deny',
          },
          'User is not Owner of tenant'
        );
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Only tenant Owners can create invitations',
        });
      }

      // Calculate bodyHash with operation scope
      const bodyHash = createHash('sha256')
        .update(JSON.stringify({ op: 'create-invite', tenantId, email, role }))
        .digest('hex');

      // Execute with idempotency
      try {
        const { fromCache, result } = await withIdempotency(
          idempotencyKey,
          async () => {
            const token = randomBytes(32).toString('base64url');
            const createdAt = new Date().toISOString();
            const expiresAt = new Date(
              Date.now() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000
            ).toISOString();

            const invitation: Invitation = {
              token,
              tenantId,
              email,
              role,
              status: 'PENDING',
              createdAt,
              expiresAt,
            };

            await invitationsRepo.create(invitation);

            return { token, tenantId, expiresAt };
          },
          { uid, bodyHash }
        );

        // Log
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid,
            tenantId,
            token: result.token,
            action: 'create_invitation',
            outcome: fromCache ? 'idempotent' : 'created',
          },
          `Invitation ${fromCache ? 'retrieved from cache' : 'created'}`
        );

        const statusCode = fromCache ? 200 : 201;
        return reply.status(statusCode).send(result);
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          return reply.status(409).send({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /invitations/:token - Get invitation details (public)
  fastify.get('/invitations/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const invitation = await invitationsRepo.getByToken(token);

    if (!invitation) {
      request.log.info(
        {
          reqId: request.headers['x-request-id'],
          token,
          action: 'get_invitation',
          outcome: 'not_found',
        },
        'Invitation not found'
      );
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Invitation not found',
      });
    }

    // Check if expired or not PENDING
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);

    if (expiresAt < now || invitation.status !== 'PENDING') {
      request.log.info(
        {
          reqId: request.headers['x-request-id'],
          token,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          action: 'get_invitation',
          outcome: 'expired_or_invalid',
        },
        'Invitation expired or no longer valid'
      );
      return reply.status(410).send({
        code: 'GONE',
        message: 'Invitation expired or no longer valid',
      });
    }

    request.log.info(
      {
        reqId: request.headers['x-request-id'],
        token,
        action: 'get_invitation',
        outcome: 'success',
      },
      'Invitation details retrieved'
    );

    // Return safe fields only
    return reply.status(200).send({
      tenantId: invitation.tenantId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    });
  });

  // POST /invitations/:token/accept - Accept invitation
  fastify.post(
    '/invitations/:token/accept',
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

      const { token } = request.params as { token: string };

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
          message: `Invalid ${IDEMPOTENCY_HEADER}`,
        });
      }

      const uid = request.user.uid;

      // Calculate bodyHash with operation scope
      const bodyHash = createHash('sha256')
        .update(JSON.stringify({ op: 'accept-invite', token }))
        .digest('hex');

      try {
        const { fromCache, result } = await withIdempotency(
          idempotencyKey,
          async () => {
            // Load invitation
            const invitation = await invitationsRepo.getByToken(token);

            if (!invitation) {
              throw new Error('NOT_FOUND');
            }

            // Check expiration
            const now = new Date();
            const expiresAt = new Date(invitation.expiresAt);

            if (expiresAt < now) {
              throw new Error('EXPIRED');
            }

            // Check status
            if (invitation.status !== 'PENDING') {
              throw new Error('NOT_PENDING');
            }

            // Verify email match if enforced
            if (env.ENFORCE_INVITE_EMAIL === 'true') {
              if (
                !request.user?.email ||
                request.user.email !== invitation.email
              ) {
                throw new Error('EMAIL_MISMATCH');
              }
            }

            const tenantId = invitation.tenantId;
            const role = invitation.role;

            // Get or create membership
            let membership = await membershipsRepo.get(tenantId, uid);

            if (!membership) {
              // Create new membership
              membership = {
                tenantId,
                uid,
                roles: [role],
                createdAt: new Date().toISOString(),
              };
              await membershipsRepo.set(membership);
            } else {
              // Merge role if not already present
              if (!membership.roles.includes(role)) {
                membership.roles.push(role);
                await membershipsRepo.set(membership);
              }
            }

            // Mark invitation as accepted
            await invitationsRepo.markAccepted(
              token,
              uid,
              new Date().toISOString()
            );

            return { tenantId, roles: membership.roles };
          },
          { uid, bodyHash }
        );

        // Log
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid,
            tenantId: result.tenantId,
            token,
            action: 'accept_invitation',
            outcome: fromCache ? 'idempotent' : 'accepted',
          },
          `Invitation ${fromCache ? 'already accepted' : 'accepted'}`
        );

        const statusCode = fromCache ? 200 : 201;
        return reply.status(statusCode).send(result);
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          return reply.status(409).send({
            code: 'CONFLICT',
            message: error.message,
          });
        }

        if (error instanceof Error) {
          if (error.message === 'NOT_FOUND') {
            return reply.status(404).send({
              code: 'NOT_FOUND',
              message: 'Invitation not found',
            });
          }

          if (error.message === 'EXPIRED' || error.message === 'NOT_PENDING') {
            return reply.status(410).send({
              code: 'GONE',
              message: 'Invitation expired or no longer valid',
            });
          }

          if (error.message === 'EMAIL_MISMATCH') {
            request.log.warn(
              {
                reqId: request.headers['x-request-id'],
                uid,
                token,
                expectedEmail: 'REDACTED',
                actualEmail: request.user?.email,
                action: 'accept_invitation',
                outcome: 'email_mismatch',
              },
              'Email mismatch for invitation'
            );
            return reply.status(403).send({
              code: 'FORBIDDEN',
              message: 'Email mismatch for invitation',
            });
          }
        }

        throw error;
      }
    }
  );

  // DELETE /invitations/:token - Cancel invitation
  fastify.delete(
    '/invitations/:token',
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

      const { token } = request.params as { token: string };
      const uid = request.user.uid;

      // Load invitation
      const invitation = await invitationsRepo.getByToken(token);

      if (!invitation) {
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid,
            token,
            action: 'cancel_invitation',
            outcome: 'not_found_idempotent',
          },
          'Invitation not found (idempotent 204)'
        );
        return reply.status(204).send();
      }

      // Check if user is Owner of the tenant (RBAC)
      const membership = await membershipsRepo.get(invitation.tenantId, uid);
      if (!membership || !membership.roles.includes('Owner')) {
        request.log.warn(
          {
            reqId: request.headers['x-request-id'],
            uid,
            tenantId: invitation.tenantId,
            token,
            action: 'cancel_invitation',
            outcome: 'deny',
          },
          'User is not Owner of tenant'
        );
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: 'Only tenant Owners can cancel invitations',
        });
      }

      // If already CANCELED or ACCEPTED, idempotent 204
      if (
        invitation.status === 'CANCELED' ||
        invitation.status === 'ACCEPTED'
      ) {
        request.log.info(
          {
            reqId: request.headers['x-request-id'],
            uid,
            tenantId: invitation.tenantId,
            token,
            status: invitation.status,
            action: 'cancel_invitation',
            outcome: 'already_done_idempotent',
          },
          'Invitation already canceled or accepted (idempotent)'
        );
        return reply.status(204).send();
      }

      // Cancel
      await invitationsRepo.cancel(token, uid, new Date().toISOString());

      request.log.info(
        {
          reqId: request.headers['x-request-id'],
          uid,
          tenantId: invitation.tenantId,
          token,
          action: 'cancel_invitation',
          outcome: 'canceled',
        },
        'Invitation canceled'
      );

      return reply.status(204).send();
    }
  );
};

export default invitationsRoutes;
