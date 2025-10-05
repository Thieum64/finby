# Build stage with Node.js dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package-docker.json package.json
RUN npm install

# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsup

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

USER nextjs

EXPOSE 8080

CMD ["node", "dist/index.js"]