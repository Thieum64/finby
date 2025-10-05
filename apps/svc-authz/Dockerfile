FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app

# Copy package.json (build context is apps/svc-authz)
COPY package.json ./package.json

# Create minimal pnpm-workspace.yaml for this build context
RUN echo 'packages: []' > pnpm-workspace.yaml

# Install dependencies
RUN pnpm install

FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy service source code (build context is apps/svc-authz)
COPY . ./

# Build the service
RUN pnpm build

FROM base AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs service

# Copy built application
COPY --from=builder --chown=service:nodejs /app/dist ./dist
COPY --from=builder --chown=service:nodejs /app/package.json ./package.json

# Install production dependencies only
RUN pnpm install --prod

USER service

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]