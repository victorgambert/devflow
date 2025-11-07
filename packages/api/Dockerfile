# DevFlow API Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.json ./

# ================================
# Dependencies Stage
# ================================
FROM base AS deps

# Copy package.json files for all packages
COPY packages/common/package.json ./packages/common/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ================================
# Build Stage
# ================================
FROM base AS builder

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY packages/common ./packages/common
COPY packages/sdk ./packages/sdk
COPY packages/api ./packages/api

# Build common package
WORKDIR /app/packages/common
RUN pnpm build

# Build SDK package
WORKDIR /app/packages/sdk
RUN pnpm build

# Generate Prisma client
WORKDIR /app/packages/api
RUN pnpm prisma:generate

# Build API
RUN pnpm build

# ================================
# Production Stage
# ================================
FROM node:20-alpine AS production

# Install OpenSSL for Prisma and pnpm
RUN apk add --no-cache openssl openssl-dev libc6-compat

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/api/package.json ./packages/api/

# Install all dependencies (needed for prisma generate)
RUN pnpm install --frozen-lockfile

# Copy built artifacts from builder
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# Set working directory to API and generate Prisma client
WORKDIR /app/packages/api
RUN pnpm prisma:generate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]
