# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
ARG SERVICE
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace

RUN test -n "$SERVICE" || (echo "ARG SERVICE manquant (ex: apps/svc-authz)" && exit 1)
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY ${SERVICE} ${SERVICE}
RUN test -f ${SERVICE}/package.json || (echo "Missing ${SERVICE}/package.json. Check .gcloudignore/.dockerignore" && ls -la ${SERVICE} && exit 1)

RUN pnpm install --prod --frozen-lockfile

FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

COPY --from=deps --chown=service:service /workspace/node_modules ./node_modules
COPY --chown=service:service ${SERVICE}/package.json ./package.json
COPY --chown=service:service ${SERVICE}/dist ./dist

EXPOSE 8080
CMD ["node","dist/index.js"]
