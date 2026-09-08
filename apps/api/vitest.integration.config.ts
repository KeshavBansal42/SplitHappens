import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests hit a real Postgres; run separately with
    // `pnpm test:integration`. Unit tests are isolated in src/.
    include: ["src/integration/**/*.test.ts"],
    setupFiles: ["src/test/setupEnv.ts"],
    testTimeout: 15000,
  },
});
