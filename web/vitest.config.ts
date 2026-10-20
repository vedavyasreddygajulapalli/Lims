import { defineConfig } from "vitest/config";
export default defineConfig({
  define: { __DEMO__: true },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
