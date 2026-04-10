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
COPY services/crm/ ./services/crm/
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @trottistore/database db:generate
# Type-check only (no JS emit is consumed — see runner stage).
RUN pnpm --filter @trottistore/service-crm exec tsc --noEmit

FROM node:22-alpine AS runner
WORKDIR /app/services/crm
ENV NODE_ENV=production
# See services/ecommerce/Dockerfile for the runtime strategy rationale.
# tsx transpiles on the fly to avoid the ESM extension-required gap
# between tsconfig moduleResolution: "bundler" and Node 22 runtime.
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/packages /app/packages
COPY --from=build --chown=node:node /app/tsconfig.base.json /app/tsconfig.base.json
COPY --from=build --chown=node:node /app/services/crm/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/crm/src ./src
COPY --from=build --chown=node:node /app/services/crm/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/services/crm/package.json ./package.json
USER node
EXPOSE 3002
CMD ["node", "--import", "tsx", "src/index.ts"]
