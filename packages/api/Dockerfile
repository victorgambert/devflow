# DevFlow API - Production Dockerfile

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:18-alpine AS deps

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/common/package.json ./packages/common/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/drivers/package.json ./packages/drivers/
COPY packages/observability/package.json ./packages/observability/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# ============================================
# Stage 2: Builder
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api ./packages/api
COPY packages/common ./packages/common
COPY packages/sdk ./packages/sdk
COPY packages/drivers ./packages/drivers
COPY packages/observability ./packages/observability

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm build

# ============================================
# Stage 3: Production
# ============================================
FROM node:18-alpine AS runner

# Security: Run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 devflow

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps --chown=devflow:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=devflow:nodejs /app/packages ./packages

# Copy built application
COPY --from=builder --chown=devflow:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=devflow:nodejs /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=devflow:nodejs /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder --chown=devflow:nodejs /app/packages/drivers/dist ./packages/drivers/dist
COPY --from=builder --chown=devflow:nodejs /app/packages/observability/dist ./packages/observability/dist

# Copy Prisma schema and migrations
COPY --from=builder --chown=devflow:nodejs /app/packages/api/prisma ./packages/api/prisma

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

USER devflow

EXPOSE 3000

CMD ["node", "packages/api/dist/main.js"]
