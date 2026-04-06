import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "ecommerce",
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
