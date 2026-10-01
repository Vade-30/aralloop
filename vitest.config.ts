import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Tests get their own in-memory database and never call a real AI service.
    env: { PGLITE_DIR: "memory", AI_PROVIDER: "mock", DATABASE_URL: "" },
    testTimeout: 30_000,
  },
});
