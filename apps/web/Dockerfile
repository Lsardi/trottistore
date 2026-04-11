FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY scripts/package.json ./scripts/
COPY services/ecommerce/package.json ./services/ecommerce/
COPY services/crm/package.json ./services/crm/
COPY services/analytics/package.json ./services/analytics/
COPY services/sav/package.json ./services/sav/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app .
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true
# next.config.ts rewrites() is evaluated at build time and the result is
# baked into .next/standalone/. So API_URL (and the 3 other API_*_URL
# vars) MUST be present during `next build`, not just at runtime.
# Without these ARGs, Railway service variables never reach `next build`
# and rewrites fall back to localhost:3001..3004 — causing 500s in prod.
ARG API_URL
ARG API_CRM_URL
ARG API_SAV_URL
ARG API_ANALYTICS_URL
ENV API_URL=$API_URL
ENV API_CRM_URL=$API_CRM_URL
ENV API_SAV_URL=$API_SAV_URL
ENV API_ANALYTICS_URL=$API_ANALYTICS_URL
RUN pnpm --filter @trottistore/database db:generate
RUN pnpm --filter @trottistore/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
USER node
CMD ["node", "apps/web/server.js"]
