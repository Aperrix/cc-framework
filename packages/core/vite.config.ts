import { defineConfig } from "vite-plus";

export default defineConfig({
  // Test — unit + e2e tests with coverage reporting
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "html"],
    },
  },
});
