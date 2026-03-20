import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 30, // Starting low, can be increased
        functions: 30,
        branches: 30,
        statements: 30,
      },
    },
  },
});
