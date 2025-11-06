# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
ARG SERVICE
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

RUN test -n "$SERVICE" || (echo "ARG SERVICE manquant (ex: apps/svc-authz)" && exit 1)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests and sources needed for dependency resolution
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY ${SERVICE} ${SERVICE}

# Install production dependencies for the workspace (service bundle lives in dist/)
RUN pnpm install --prod --frozen-lockfile

FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

# Copy production dependencies and service manifest
COPY --from=deps --chown=service:service /workspace/node_modules ./node_modules
COPY --from=deps --chown=service:service /workspace/${SERVICE}/package.json ./package.json

# Copy pre-built service bundle (dist) from the workspace context
COPY --chown=service:service ${SERVICE}/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
