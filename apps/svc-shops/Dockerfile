FROM node:20-alpine AS deps
WORKDIR /workspace
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests and service sources for dependency resolution
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/svc-shops ./apps/svc-shops

# Install only production dependencies and create trimmed runtime output
RUN pnpm install --prod --frozen-lockfile
RUN pnpm deploy --filter=@hyperush/svc-shops --prod /tmp/service-runtime
RUN test -f apps/svc-shops/dist/index.js || (echo 'dist build missing for svc-shops' && false)

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN adduser -D service
USER service

# Copy production dependencies
COPY --from=deps --chown=service:service /tmp/service-runtime ./

# Copy the pre-built bundle
COPY --chown=service:service apps/svc-shops/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
