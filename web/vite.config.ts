import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss()],
  define: { __DEMO__: JSON.stringify(mode === "demo") },
  server: { proxy: { "/api": "http://127.0.0.1:4000" } },
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
}));
