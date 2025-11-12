# syntax=docker/dockerfile:1

# Build stage - install all dependencies and build all packages
FROM node:20-alpine AS builder
WORKDIR /workspace
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps ./apps

# Install all dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Build all packages and apps
# Use || true to continue even if some builds fail (non-critical packages)
RUN pnpm --filter "@hp/*" build || true
RUN pnpm --filter "@hyperush/*" build || true

# Verify critical packages built successfully
RUN test -f packages/lib-common/dist/index.js || (echo "ERROR: lib-common failed to build" && exit 1)
RUN test -f packages/lib-firestore/dist/index.js || (echo "ERROR: lib-firestore failed to build" && exit 1)

# Base runtime stage - workspace with all built artifacts
FROM node:20-alpine AS base
WORKDIR /opt/workspace
ENV NODE_ENV=production

# Copy entire workspace with node_modules and dist artifacts
COPY --from=builder /workspace/ ./

# Create non-root user
RUN adduser -D service && chown -R service:service /opt/workspace
USER service

EXPOSE 8080
