import { defineConfig } from "vite-plus";

export default defineConfig({
  // Oxfmt — consistent formatting
  fmt: {},

  // Oxlint — type-aware linting with TypeScript type checking
  lint: {
    ignorePatterns: ["dist/**", "coverage/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "no-console": ["error", { allow: ["error", "warn", "debug"] }],
    },
  },

  // Vitest — unit + e2e tests with coverage
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      reporter: ["text", "html"],
    },
  },

  // Vite Task — monorepo task orchestration with caching
  run: {
    cache: true,
  },
});
