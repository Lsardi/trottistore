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
COPY services/ecommerce/ ./services/ecommerce/
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @trottistore/database db:generate
# Type-check only (no JS emit is consumed — see runner stage).
RUN pnpm --filter @trottistore/service-ecommerce exec tsc --noEmit

FROM node:22-alpine AS runner
WORKDIR /app/services/ecommerce
ENV NODE_ENV=production
# Runtime strategy: use `tsx` as a Node import loader to transpile
# TypeScript on the fly. Rationale: the repo's tsconfig uses
# moduleResolution: "bundler" which does NOT enforce `.js` extensions
# on relative imports, but every service has `"type": "module"` in
# package.json so Node 22 runs the output in ESM mode, which DOES
# require explicit extensions. `tsc` does not rewrite imports, so
# `node dist/index.js` crashes at runtime with ERR_MODULE_NOT_FOUND on
# the first extensionless relative import. `tsx` sidesteps this by
# handling module resolution itself (file extensions, TS paths, JSX,
# workspace packages). Cold start overhead ~500-800ms, acceptable
# for the week-0 demo. A cleaner long-term fix is to migrate the
# repo to moduleResolution: "nodenext" with explicit `.js` extensions
# in all source imports — tracked for post-demo cleanup.
#
# pnpm layout: root node_modules has the flat .pnpm store, service
# node_modules has symlinks into it, packages/* are workspace symlink
# targets — all three must be present at their build-time paths.
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/packages /app/packages
COPY --from=build --chown=node:node /app/tsconfig.base.json /app/tsconfig.base.json
COPY --from=build --chown=node:node /app/services/ecommerce/node_modules ./node_modules
COPY --from=build --chown=node:node /app/services/ecommerce/src ./src
COPY --from=build --chown=node:node /app/services/ecommerce/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/services/ecommerce/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "--import", "tsx", "src/index.ts"]
