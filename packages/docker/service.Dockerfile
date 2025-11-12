# syntax=docker/dockerfile:1

# ARG before FROM for base image reference
ARG BASE_IMAGE=europe-west1-docker.pkg.dev/hyperush-dev-250930115246/services/base:latest
FROM ${BASE_IMAGE}

# ARG after FROM for build-time variables in this stage
ARG SERVICE
WORKDIR /opt/workspace/apps/${SERVICE}

ENV NODE_ENV=production
ENV ENABLE_OTEL=false
ENV HOST=0.0.0.0
ENV PORT=8080

CMD ["node", "dist/index.js"]
