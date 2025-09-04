FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml ./

# Copy service package.json
COPY apps/svc-authz/package.json ./apps/svc-authz/

# Copy any shared packages referenced (lib-common if it exists)
COPY packages/ ./packages/ 2>/dev/null || true

# Install dependencies
RUN pnpm install --frozen-lockfile --filter=@hyperush/svc-authz

FROM base AS builder  
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/svc-authz/node_modules ./apps/svc-authz/node_modules 2>/dev/null || true

# Copy service source code
COPY apps/svc-authz ./apps/svc-authz

# Copy workspace config for build
COPY package.json pnpm-lock.yaml ./

# Copy shared packages (if any)
COPY packages/ ./packages/ 2>/dev/null || true

# Build the service
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