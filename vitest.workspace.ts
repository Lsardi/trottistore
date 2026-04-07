import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "services/ecommerce/vitest.config.ts",
      "services/crm/vitest.config.ts",
      "services/sav/vitest.config.ts",
      "services/analytics/vitest.config.ts",
      "packages/shared/vitest.config.ts",
      "apps/web/vitest.config.ts",
    ],
  },
});
