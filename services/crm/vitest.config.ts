import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "crm",
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
