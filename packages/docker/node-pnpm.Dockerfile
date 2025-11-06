# syntax=docker/dockerfile:1
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# SERVICE doit correspondre à un répertoire d'application (ex: apps/svc-authz)
ARG SERVICE
RUN test -n "$SERVICE" || (echo "ARG SERVICE manquant" && exit 1)

RUN adduser -D service \
 && corepack enable && corepack prepare pnpm@9 --activate

# Installer uniquement les dépendances production du service via pnpm + lockfile mono-repo
COPY pnpm-lock.yaml ./
COPY ${SERVICE}/package.json ./package.json
RUN pnpm install --prod --frozen-lockfile

# Copier le bundle préconstruit du service (dist)
COPY ${SERVICE}/dist ./dist

USER service
EXPOSE 8080
CMD ["node", "dist/index.js"]
