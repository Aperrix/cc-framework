import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
