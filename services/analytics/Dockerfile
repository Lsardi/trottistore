FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY services/analytics/ ./services/analytics/
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm --filter @trottistore/database db:generate
RUN pnpm --filter @trottistore/service-analytics build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/analytics/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/database/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3003
CMD ["node", "dist/index.js"]
