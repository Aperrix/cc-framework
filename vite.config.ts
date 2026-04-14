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

  // Vite Task — monorepo task caching
  run: {
    cache: true,
  },
});
