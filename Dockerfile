# Multi-stage build for Next.js
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

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
EXPOSE 3000
CMD ["node", "server.js"]
