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
      exclude: [
        "**/index.ts", // barrel exports
        "**/runners/ai-runner.ts", // requires Claude Agent SDK
        "**/runners/code-mode-runner.ts", // requires Claude Agent SDK
        "**/events/event-bus.ts", // empty class extending EventEmitter
      ],
      reporter: ["text", "html"],
    },
  },

  // Vite Task — monorepo task caching
  run: {
    cache: true,
  },
});
