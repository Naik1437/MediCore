# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Ensure OpenSSL 3 is available during Prisma generation
RUN apk add --no-cache openssl libc6-compat

# Copy root monorepo manifests and backend files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/prisma ./backend/prisma/

# Install all dependencies using the monorepo root package-lock.json
RUN npm ci

# Generate Prisma Client using the pinned local prisma binary
RUN npx prisma generate --schema=backend/prisma/schema.prisma

# Copy backend source and compile TypeScript
COPY backend/src ./backend/src
RUN npm --prefix backend run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4002

# Security & runtime: Install OpenSSL for Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy workspace configuration and pre-installed dependencies from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/src/docs ./backend/dist/docs
COPY --from=builder /app/backend/src/docs ./backend/src/docs

WORKDIR /app/backend

# Security: Ensure files are owned by standard non-root user 'node'
RUN chown -R node:node /app

USER node

EXPOSE 4002

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:4002/api/v1/health/live", (res) => process.exit(res.statusCode === 200 ? 0 : 1))'

CMD ["node", "dist/server.js"]
