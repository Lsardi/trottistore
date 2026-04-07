import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    experimental: {
      fsModuleCache: true,
    },
    projects: [
      "services/ecommerce/vitest.config.ts",
      "services/crm/vitest.config.ts",
      "services/sav/vitest.config.ts",
      "services/analytics/vitest.config.ts",
      "packages/shared/vitest.config.ts",
      "apps/web/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["services/*/src/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
