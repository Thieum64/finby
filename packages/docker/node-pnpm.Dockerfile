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

# Install production dependencies for the entire workspace (will be pruned later)
RUN pnpm install --prod --frozen-lockfile

# Determine scoped package name for the service and create trimmed runtime with pnpm deploy
RUN PKG_NAME=$(node -e "const fs=require('fs'); const svc=process.env.SERVICE; const pkg=JSON.parse(fs.readFileSync(\`./${SERVICE}/package.json\`, 'utf8')); if(!pkg.name){process.exit(1);} console.log(pkg.name);") \
 && pnpm deploy --filter \"$PKG_NAME\" --prod /tmp/service-runtime

FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

# Copy production dependencies output by pnpm deploy
COPY --from=deps --chown=service:service /tmp/service-runtime ./

# Copy pre-built service bundle (dist) from the workspace context
COPY --chown=service:service ${SERVICE}/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
