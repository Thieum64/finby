# syntax=docker/dockerfile:1

# Use the monorepo base image with all dependencies pre-built
ARG BASE_IMAGE=europe-west1-docker.pkg.dev/hyperush-dev-250930115246/services/base:latest
FROM ${BASE_IMAGE}

WORKDIR /app
ARG SERVICE
ENV NODE_ENV=production

# Copy service-specific files from base workspace
# The base image already has everything built in /opt/workspace
COPY --chown=service:service /opt/workspace/apps/${SERVICE}/package.json ./package.json
COPY --chown=service:service /opt/workspace/apps/${SERVICE}/dist ./dist
COPY --chown=service:service /opt/workspace/node_modules ./node_modules
COPY --chown=service:service /opt/workspace/packages ./packages

# Create boot diagnostics wrapper
RUN printf '#!/bin/sh\n\
set -e\n\
echo "=== BOOT DIAGNOSTICS ==="\n\
echo "Node: $(node -v)"\n\
echo "CWD: $(pwd)"\n\
echo "USER: $(whoami)"\n\
ls -la /app | head -20\n\
echo ""\n\
echo "=== RESOLVE CHECKS ==="\n\
node -e "try{console.log(\"✓ @hp/lib-common:\",require.resolve(\"@hp/lib-common/package.json\"))}catch(e){console.error(\"✗ @hp/lib-common:\",e.message);process.exit(1)}"\n\
node -e "try{console.log(\"✓ @hyperush/lib-otel:\",require.resolve(\"@hyperush/lib-otel/package.json\"))}catch(e){console.error(\"✗ @hyperush/lib-otel (optional):\",e.message)}"\n\
echo ""\n\
echo "=== ENV VARS (non-sensitive) ==="\n\
node -e "const keys=Object.keys(process.env).filter(k=>/^[A-Z][A-Z0-9_]*$/.test(k)&&!k.match(/KEY|SECRET|TOKEN|PASS/)).sort();console.log(keys.slice(0,50).join(\",\"))"\n\
echo "PORT: ${PORT:-8080}"\n\
echo ""\n\
echo "=== STARTING SERVICE ==="\n\
exec node dist/index.js\n' > /app/start.sh && chmod +x /app/start.sh

# Verify dist/index.js exists
RUN test -f ./dist/index.js || (echo "ERROR: dist/index.js not found" && ls -laR ./dist && exit 1)

EXPOSE 8080
CMD ["/app/start.sh"]
