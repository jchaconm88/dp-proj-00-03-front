FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

FROM base AS builder
ARG CMS_URL=http://localhost:3000
ARG TURNSTILE_SITE_KEY=
ARG WEBHOOK_SECRET=build-placeholder-webhook-secret
ARG TURNSTILE_SECRET_KEY=
ENV CMS_URL=$CMS_URL
ENV TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY
ENV WEBHOOK_SECRET=$WEBHOOK_SECRET
ENV TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET_KEY
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 astro

# SSR (@astrojs/node) resuelve imports externos (p. ej. mustache) desde node_modules en runtime
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder --chown=astro:nodejs /app/dist ./dist

USER astro
EXPOSE 8080

CMD ["node", "./dist/server/entry.mjs"]
