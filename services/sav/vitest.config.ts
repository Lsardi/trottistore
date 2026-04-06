import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "sav",
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
