FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY apps/svc-authz/package.json ./apps/svc-authz/
RUN pnpm install --frozen-lockfile --filter=@hyperush/svc-authz

FROM base AS builder  
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/svc-authz/node_modules ./apps/svc-authz/node_modules
COPY . .
RUN pnpm --filter=@hyperush/svc-authz build

FROM base AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs service

# Copy built application
COPY --from=builder --chown=service:nodejs /app/apps/svc-authz/dist ./dist
COPY --from=builder --chown=service:nodejs /app/apps/svc-authz/package.json ./package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

USER service

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

CMD ["node", "dist/index.js"]