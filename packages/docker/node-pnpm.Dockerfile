# syntax=docker/dockerfile:1

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

FROM node:20-alpine AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app

RUN adduser -D service && chown service:service /app
USER service

COPY --from=deps --chown=service:service /workspace/node_modules ./node_modules
COPY --from=deps --chown=service:service /workspace/${SERVICE}/package.json ./package.json
COPY --from=deps --chown=service:service /workspace/${SERVICE}/dist ./dist

RUN test -f ./dist/index.js

EXPOSE 8080
CMD ["node","dist/index.js"]
