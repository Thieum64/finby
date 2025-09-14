# Hyperush Universal Node.js Multi-stage Dockerfile
# Stage 1: Builder - Build the application
FROM node@sha256:eabac870db94f7342d6c33560d6613f188bbcf4bbe1f4eb47d5e2a08e1a37722 AS builder

# Install pnpm via corepack with pinned version
RUN corepack enable && corepack prepare pnpm@9.1.4 --activate

# Build argument for service name
ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build arg is required" && false)

# Set working directory
WORKDIR /app

# Copy workspace configuration files for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy source code (selective copy for better caching)
COPY packages/ packages/
COPY apps/ apps/

# Install all dependencies 
RUN pnpm install --frozen-lockfile

# Copy pre-built dist directories (building locally to avoid Docker tsup issues)
# This assumes CI builds these locally before Docker build
RUN ls -la apps/$SERVICE/dist || echo "dist not found - will be copied from builder context"

# Remove dev dependencies to minimize image size
RUN pnpm prune --prod

# Create minimal runtime structure
RUN mkdir -p /tmp/service-runtime && \
    cp -r node_modules /tmp/service-runtime/ && \
    cp package.json /tmp/service-runtime/

# Stage 2: Runtime - Minimal production image  
FROM node@sha256:eabac870db94f7342d6c33560d6613f188bbcf4bbe1f4eb47d5e2a08e1a37722 AS runtime

# Create non-root user for security (Alpine style)
RUN addgroup -g 1001 -S service && \
    adduser -S service -u 1001 -G service

# Set working directory
WORKDIR /app

# Declare ARG again for this stage
ARG SERVICE

# Copy built application and production dependencies from builder stage
COPY --from=builder --chown=service:service /tmp/service-runtime .
COPY --from=builder --chown=service:service /app/apps/$SERVICE/dist ./dist

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