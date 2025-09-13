# Hyperush Universal Node.js Dockerfile Template
# Pinned base image for security and reproducibility
FROM node@sha256:eabac870db94f7342d6c33560d6613f188bbcf4bbe1f4eb47d5e2a08e1a37722 AS base

# Install pnpm via corepack with pinned version
RUN corepack enable && corepack prepare pnpm@9.1.4 --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Stage 2: Dependencies
FROM base AS deps

# Build argument for service name
ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build arg is required" && false)

# Install dependencies for the specific service only
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile --filter=@hyperush/$SERVICE...

# Stage 3: Build
FROM deps AS build

# Build the service and its dependencies
RUN pnpm --filter=@hyperush/$SERVICE... build

# Stage 4: Runtime (final stage)
FROM base AS runtime

# Build argument for service name (needed in runtime)
ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build arg is required" && false)

# Create non-root user for security
RUN addgroup -g 1001 -S service && \
    adduser -S service -u 1001

# Copy built application
COPY --from=build --chown=service:service /app/apps/$SERVICE/dist ./dist
COPY --from=build --chown=service:service /app/node_modules ./node_modules

# Switch to non-root user
USER service

# Health check on /healthz endpoint (Cloud Run requirement)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e " \
    const http = require('http'); \
    const options = { \
      hostname: 'localhost', \
      port: process.env.PORT || 8080, \
      path: '/healthz', \
      timeout: 2000 \
    }; \
    const req = http.request(options, (res) => { \
      if (res.statusCode === 200) process.exit(0); \
      else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Expose port (Cloud Run provides PORT environment variable)
EXPOSE 8080

# Start the service
CMD ["node", "dist/index.js"]