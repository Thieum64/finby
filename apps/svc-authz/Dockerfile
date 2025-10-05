FROM node:20-alpine AS deps
WORKDIR /app
# on évite le workspace: on utilise le package-docker.json dédié
COPY package-docker.json package.json
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# build TS -> dist avec tsup
RUN npx tsup

FROM node:20-alpine AS runtime
WORKDIR /app
# Install curl for healthcheck
RUN apk add --no-cache curl
# on réutilise node_modules du stage deps (simple et fiable pour Phase 0)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
CMD ["node","dist/index.js"]
