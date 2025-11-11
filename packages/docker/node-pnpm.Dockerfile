# syntax=docker/dockerfile:1

# Build stage - install all dependencies and build the service
FROM node:20-alpine AS builder
ARG SERVICE
ENV NODE_ENV=development
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace files
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

# Production dependencies stage
FROM node:20-alpine AS deps
ARG SERVICE
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY ${SERVICE} ${SERVICE}

RUN pnpm install --prod --frozen-lockfile

# Runtime stage - minimal image with only what's needed to run
FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

# Copy production node_modules
COPY --from=deps --chown=service:service /workspace/node_modules ./node_modules

# Copy built artifacts from builder
COPY --from=builder --chown=service:service /workspace/${SERVICE}/package.json ./package.json
COPY --from=builder --chown=service:service /workspace/${SERVICE}/dist ./dist

# Copy built packages (lib-otel, etc.)
COPY --from=builder --chown=service:service /workspace/packages ./packages

# Final verification
RUN test -f ./dist/index.js || (echo "ERROR: dist/index.js not found in final image" && ls -la . && exit 1)

EXPOSE 8080
CMD ["node","dist/index.js"]
