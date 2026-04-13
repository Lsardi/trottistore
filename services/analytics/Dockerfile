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
COPY services/analytics/ ./services/analytics/
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @trottistore/database db:generate
# Type-check only (no JS emit is consumed — see runner stage).
RUN pnpm --filter @trottistore/service-analytics exec tsc --noEmit

FROM node:22-alpine AS runner
WORKDIR /app/services/analytics
ENV NODE_ENV=production
# See services/ecommerce/Dockerfile for the runtime strategy rationale.
# tsx transpiles on the fly to avoid the ESM extension-required gap.
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/packages /app/packages
COPY --from=build --chown=node:node /app/tsconfig.base.json /app/tsconfig.base.json
COPY --from=build --chown=node:node /app/services/analytics/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/analytics/src ./src
COPY --from=build --chown=node:node /app/services/analytics/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/services/analytics/package.json ./package.json
USER node
EXPOSE 3003
CMD ["node", "--import", "tsx", "src/index.ts"]
