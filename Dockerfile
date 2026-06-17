# Production Dockerfile for Phase 1 backend
# Node 22 LTS on Alpine — small, fast, well-supported.

FROM node:22-alpine AS deps
WORKDIR /app

# Install OpenSSL (Prisma needs it on Alpine).
RUN apk add --no-cache openssl

# Install only what's needed to install deps.
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install dependencies and generate Prisma client (postinstall runs `prisma generate`).
RUN npm install --omit=dev --no-audit --no-fund

# ---- Runtime stage ---------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl

# Bring over installed node_modules and the rest of the source.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# On startup: push the Prisma schema to Postgres (creates tables on first run,
# applies safe diffs on subsequent ones), then start the Express server.
# To seed the database the first time, exec into the container and run:
#   npm run db:seed
CMD ["npm", "run", "deploy:start"]
