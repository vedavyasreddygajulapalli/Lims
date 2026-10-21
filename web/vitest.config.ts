import { defineConfig } from "vitest/config";
export default defineConfig({
  define: { __DEMO__: true },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 15000,
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
