FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/ecommerce/package.json ./services/ecommerce/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --filter @trottistore/service-ecommerce...

FROM base AS build
WORKDIR /app
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --from=deps /app .
COPY . .
RUN pnpm --filter @trottistore/database db:generate
RUN pnpm --filter @trottistore/service-ecommerce build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/ecommerce/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
