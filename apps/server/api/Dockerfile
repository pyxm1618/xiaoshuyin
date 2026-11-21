# syntax=docker/dockerfile:1

# Stage 1: Build the API distribution and migrations runner with Bun
FROM oven/bun:1.4.4-alpine AS builder

WORKDIR /app

# Copy root manifest and lockfile for deterministic dependency resolution
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/server/api/package.json apps/server/api/
COPY packages/authorization/package.json packages/authorization/
COPY packages/compliance/package.json packages/compliance/
COPY packages/contracts/package.json packages/contracts/
COPY packages/domain/package.json packages/domain/
COPY packages/scenes/package.json packages/scenes/

# Install workspace dependencies using frozen lockfile
RUN bun install --frozen-lockfile

# Copy full application and package source code
COPY apps/server/api apps/server/api
COPY packages packages
COPY db db
COPY scripts scripts

# Build self-contained Node.js ESM executables
RUN bun build apps/server/api/src/server.ts --target=node --outfile=dist/server.js
RUN bun build scripts/db-migrate.mjs --target=node --outfile=dist/migrate.js

# Stage 2: Minimal production container runtime with Node 26.13.1
FROM node:26.13.1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0

# Copy compiled production bundle and migrations
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/db/migrations /app/db/migrations

# Security: run as non-root user 'node' provided by the base image
USER node

EXPOSE 8787

# Healthcheck against the unauthenticated /healthz endpoint
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "dist/server.js"]
