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
COPY apps ./apps

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Build workspace packages individually to avoid cascade failures
RUN pnpm --filter "@hp/lib-common" build || true
RUN pnpm --filter "@hp/lib-firestore" build || true
RUN pnpm --filter "@hp/lib-shopify" build || true
RUN pnpm --filter "@hp/sdk-authz" build || true
# lib-otel has TypeScript DTS generation issues but JS/CJS/ESM builds work
RUN pnpm --filter "@hyperush/lib-otel" build || true

# Build the specific service
RUN pnpm --filter @hyperush/$(basename ${SERVICE}) build || \
    pnpm --filter @hp/$(basename ${SERVICE}) build

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

# Copy built artifacts from builder (all packages + service)
COPY --from=builder /workspace/packages/lib-common/dist ./packages/lib-common/dist
COPY --from=builder /workspace/packages/lib-firestore/dist ./packages/lib-firestore/dist
COPY --from=builder /workspace/packages/lib-otel/dist ./packages/lib-otel/dist
COPY --from=builder /workspace/packages/lib-shopify/dist ./packages/lib-shopify/dist
COPY --from=builder /workspace/packages/sdk-authz/dist ./packages/sdk-authz/dist
COPY --from=builder /workspace/${SERVICE}/dist ${SERVICE}/dist

# Use pnpm deploy to create a standalone deployment
# This resolves all workspace dependencies into node_modules
RUN pnpm deploy --filter=@hyperush/$(basename ${SERVICE}) --prod /opt/app || \
    pnpm deploy --filter=@hp/$(basename ${SERVICE}) --prod /opt/app

# Runtime stage - minimal image with only what's needed to run
FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

# Copy the deployed service from deploy stage
# This includes all dependencies properly resolved in node_modules
COPY --from=deploy --chown=service:service /opt/app ./

# Copy dist from builder to ensure we have the built service code
COPY --from=builder --chown=service:service /workspace/${SERVICE}/dist ./dist

# Create boot wrapper for verbose diagnostics
RUN printf '#!/bin/sh\n' > /app/start.sh && \
    printf 'set -e\n' >> /app/start.sh && \
    printf 'echo "=== BOOT DIAGNOSTICS ==="\n' >> /app/start.sh && \
    printf 'echo "Node: $(node -v)"\n' >> /app/start.sh && \
    printf 'echo "CWD: $(pwd)"\n' >> /app/start.sh && \
    printf 'echo "USER: $(whoami)"\n' >> /app/start.sh && \
    printf 'ls -la /app | head -20\n' >> /app/start.sh && \
    printf 'echo ""\n' >> /app/start.sh && \
    printf 'echo "=== RESOLVE CHECKS ==="\n' >> /app/start.sh && \
    printf 'node -e "try{console.log(\"✓ @hp/lib-common:\",require.resolve(\"@hp/lib-common/package.json\"))}catch(e){console.error(\"✗ @hp/lib-common:\",e.message)}"\n' >> /app/start.sh && \
    printf 'node -e "try{console.log(\"✓ @hp/lib-firestore:\",require.resolve(\"@hp/lib-firestore/package.json\"))}catch(e){console.error(\"✗ @hp/lib-firestore:\",e.message)}"\n' >> /app/start.sh && \
    printf 'node -e "try{console.log(\"✓ @hyperush/lib-otel:\",require.resolve(\"@hyperush/lib-otel/package.json\"))}catch(e){console.error(\"✗ @hyperush/lib-otel:\",e.message)}"\n' >> /app/start.sh && \
    printf 'echo ""\n' >> /app/start.sh && \
    printf 'echo "=== ENV VARS (non-sensitive) ==="\n' >> /app/start.sh && \
    printf 'node -e "const keys=Object.keys(process.env).filter(k=>/^[A-Z][A-Z0-9_]*$/.test(k)&&!k.match(/KEY|SECRET|TOKEN|PASS/)).sort();console.log(keys.slice(0,30).join(\",\"))"\n' >> /app/start.sh && \
    printf 'echo ""\n' >> /app/start.sh && \
    printf 'echo "=== STARTING SERVICE ==="\n' >> /app/start.sh && \
    printf 'exec node dist/index.js\n' >> /app/start.sh && \
    chmod +x /app/start.sh

# Verify final structure
RUN test -f ./dist/index.js || (echo "ERROR: dist/index.js not found in final image" && ls -laR . && exit 1)

EXPOSE 8080
CMD ["/app/start.sh"]
