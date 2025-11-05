FROM node:20-alpine AS deps
WORKDIR /workspace
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests and service sources for dependency resolution
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/svc-authz ./apps/svc-authz

# Install only production dependencies and create a trimmed runtime output
RUN pnpm install --prod --frozen-lockfile
RUN pnpm deploy --filter=@hyperush/svc-authz --prod /tmp/service-runtime
RUN test -f apps/svc-authz/dist/index.js || (echo 'dist build missing for svc-authz' && false)

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as non-root user for security
RUN adduser -D service
USER service

# Copy production dependencies
COPY --from=deps --chown=service:service /tmp/service-runtime ./

# Copy the pre-built application bundle
COPY --chown=service:service apps/svc-authz/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
