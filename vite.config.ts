import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  optimizeDeps: {
    exclude: ["@niivue/dcm2niix"],
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
