# syntax=docker/dockerfile:1

# Build stage - install all dependencies and build the service
FROM node:20-alpine AS builder
ARG SERVICE
ENV NODE_ENV=development
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace files maintaining original structure
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY ${SERVICE} ${SERVICE}

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Build packages first (lib-otel and others)
RUN pnpm -r --filter "./packages/**" build || true

# Build the specific service
RUN pnpm --filter @hyperush/$(basename ${SERVICE}) build

# Verify dist exists
RUN test -f ${SERVICE}/dist/index.js || (echo "ERROR: ${SERVICE}/dist/index.js not found after build" && ls -la ${SERVICE}/ && exit 1)

# Deploy stage - create standalone deployment with all dependencies
FROM node:20-alpine AS deploy
ARG SERVICE
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace files maintaining original structure for pnpm deploy
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY ${SERVICE}/package.json ${SERVICE}/package.json

# Copy built artifacts from builder
# Copy each package's dist directory individually (wildcards don't work with multiple sources)
COPY --from=builder /workspace/packages/lib-common/dist ./packages/lib-common/dist
COPY --from=builder /workspace/packages/lib-firestore/dist ./packages/lib-firestore/dist
COPY --from=builder /workspace/packages/lib-otel/dist ./packages/lib-otel/dist
COPY --from=builder /workspace/packages/lib-shopify/dist ./packages/lib-shopify/dist
COPY --from=builder /workspace/packages/sdk-authz/dist ./packages/sdk-authz/dist
COPY --from=builder /workspace/${SERVICE}/dist ${SERVICE}/dist

# Use pnpm deploy to create a standalone deployment
# This resolves all workspace dependencies into node_modules
RUN pnpm deploy --filter=@hyperush/$(basename ${SERVICE}) --prod /deploy

# Runtime stage - minimal image with only what's needed to run
FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

# Copy the deployed service from deploy stage
# This includes all dependencies properly resolved in node_modules
COPY --from=deploy --chown=service:service /deploy ./

# Final verification
RUN test -f ./dist/index.js || (echo "ERROR: dist/index.js not found in final image" && ls -laR . && exit 1)

EXPOSE 8080
CMD ["node", "dist/index.js"]
