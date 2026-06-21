# ─────────────────────────────────────────────────────────────────────────────
# F48 Backend — Docker (Railway deployment)
# Migrations run automatically on container start (prisma migrate deploy).
# ─────────────────────────────────────────────────────────────────────────────

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy Prisma schema + config and generate client
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src/
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ─────────────────────────────────────────────────────────────────────────────
# Production stage
FROM node:22-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S f48 && \
    adduser -S f48 -u 1001 -G f48

WORKDIR /app

# Copy built artifacts + Prisma migrations for deploy
COPY --from=builder --chown=f48:f48 /app/dist ./dist/
COPY --from=builder --chown=f48:f48 /app/node_modules ./node_modules/
COPY --from=builder --chown=f48:f48 /app/package.json ./
COPY --from=builder --chown=f48:f48 /app/prisma ./prisma/
COPY --from=builder --chown=f48:f48 /app/prisma.config.ts ./

USER f48

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/v1/health || exit 1

EXPOSE ${PORT:-3000}

# Runs migrations automatically then starts the app
CMD ["npm", "run", "start:prod"]
