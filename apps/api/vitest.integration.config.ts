import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/integration/**/*.test.ts"],
    setupFiles: ["src/test/setupEnv.ts"],
    testTimeout: 15000,
  },
});
