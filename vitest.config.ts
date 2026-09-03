import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/mocks/server-only.js", import.meta.url)
      ),
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "@hrms/api-contract": fileURLToPath(
        new URL("./packages/api-contract/src/index.ts", import.meta.url)
      ),
      "@hrms/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url)
      ),
      "@hrms/config": fileURLToPath(
        new URL("./packages/config/src/index.ts", import.meta.url)
      ),
      "@hrms/ui-tokens": fileURLToPath(
        new URL("./packages/ui-tokens/src/index.ts", import.meta.url)
      ),
    },
  },
});
