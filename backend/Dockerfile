# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for build
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY src ./src
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4002

# Security: Install OpenSSL for Prisma engine if required and use non-root user
RUN apk add --no-cache openssl libc6-compat

# Copy dependency definitions and production install
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist
COPY src/docs ./dist/docs

# Security: Switch to standard non-root user 'node'
USER node

EXPOSE 4002

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:4002/api/v1/health/live", (res) => process.exit(res.statusCode === 200 ? 0 : 1))'

CMD ["node", "dist/server.js"]
