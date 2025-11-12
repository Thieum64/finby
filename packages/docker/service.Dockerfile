# syntax=docker/dockerfile:1

ARG BASE_IMAGE
ARG SERVICE
FROM ${BASE_IMAGE}
WORKDIR /opt/workspace/apps/${SERVICE}
ENV NODE_ENV=production
ENV ENABLE_OTEL=false
ENV HOST=0.0.0.0
ENV PORT=8080
CMD ["node", "dist/index.js"]
