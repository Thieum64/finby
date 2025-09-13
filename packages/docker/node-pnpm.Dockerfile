# Hyperush Universal Node.js Dockerfile Template
# Pinned base image for security and reproducibility
FROM node@sha256:eabac870db94f7342d6c33560d6613f188bbcf4bbe1f4eb47d5e2a08e1a37722

# Install pnpm via corepack with pinned version
RUN corepack enable && corepack prepare pnpm@9.1.4 --activate

# Build argument for service name
ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build arg is required" && false)

# Set working directory
WORKDIR /app

# Copy everything first
COPY . .

# Install dependencies and build
RUN pnpm install --frozen-lockfile --filter=@hyperush/$SERVICE...
RUN pnpm --filter=@hyperush/$SERVICE... build

# Create non-root user for security
RUN addgroup -g 1001 -S service && \
    adduser -S service -u 1001 && \
    chown -R service:service /app

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

# Start the service (copy to fixed location since CMD doesn't support variable expansion)
RUN ln -s /app/apps/$SERVICE/dist /app/service-dist

# Start the service
CMD ["node", "service-dist/index.js"]