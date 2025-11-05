# Hyperush Universal Node.js Multi-stage Dockerfile
# Builder: node@sha256:eabac870db94f7342d6c33560d6613f188bbcf4bbe1f4eb47d5e2a08e1a37722 (node:22)
# Runtime: node:20-slim@sha256:3d2dc1bc9b2a3c01c8e65bb2f9e47a8c7e6bd3d8c1a59cf9b2e72e2be86c4e1e

# Stage 1: Builder - Build the application
FROM node@sha256:eabac870db94f7342d6c33560d6613f188bbcf4bbe1f4eb47d5e2a08e1a37722 AS builder

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Install pnpm via corepack with pinned version
RUN corepack enable && corepack prepare pnpm@9.1.4 --activate

# Build argument for service name
ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build arg is required" && false)

# Copy workspace configuration files for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy source code (selective copy for better caching)
COPY packages/ packages/
COPY apps/ apps/

# Install production dependencies only (build happens beforehand in CI)
RUN pnpm install --prod --frozen-lockfile

# Test that the built binary exists
RUN test -f apps/$SERVICE/dist/index.js || (echo "Build failed: apps/$SERVICE/dist/index.js not found" && false)

# Create clean runtime structure using pnpm deploy
RUN pnpm deploy --filter=@hyperush/$SERVICE --prod /tmp/service-runtime

# Stage 2: Runtime - Minimal production image
FROM node:20-slim@sha256:3d2dc1bc9b2a3c01c8e65bb2f9e47a8c7e6bd3d8c1a59cf9b2e72e2be86c4e1e AS runtime

# Create non-root user for security
RUN groupadd -g 1001 service && useradd -r -u 1001 -g service service

WORKDIR /app

# Build argument for service name
ARG SERVICE

# Copy clean production dependencies from pnpm deploy
COPY --from=builder --chown=service:service /tmp/service-runtime ./

# Copy built application from builder stage
COPY --from=builder --chown=service:service /app/apps/$SERVICE/dist ./dist

# Switch to non-root user
USER service

# Expose port (Cloud Run provides PORT environment variable)
EXPOSE 8080

# Test that the built binary exists in runtime
RUN test -f dist/index.js || (echo "Runtime validation failed: dist/index.js not found" && false)

# Start the service
CMD ["node", "dist/index.js"]
