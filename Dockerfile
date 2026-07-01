# syntax=docker/dockerfile:1.7

# Multi-stage build for Next.js
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app
RUN pnpm config set store-dir /pnpm/store

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache pnpm build

FROM deps AS prod-deps
RUN pnpm prune --prod

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/migrations ./migrations
# Fonts read at runtime by the region opengraph-image route
# (readFile(join(process.cwd(), "assets/...")) — not traced into standalone).
COPY --from=builder /app/assets ./assets
EXPOSE 3000
CMD ["node", "server.js"]
