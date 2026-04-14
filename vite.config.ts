import { defineConfig } from "vite-plus";

export default defineConfig({
  // Pre-commit — run check with auto-fix on staged files
  staged: {
    "*": "vp check --fix",
  },

  // Oxfmt — consistent formatting across all packages
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

  // Vitest — test and coverage for all packages in monorepo
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
    coverage: {
      include: ["packages/*/src/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },

  // Vite Task — monorepo task caching
  run: {
    cache: true,
  },
});
