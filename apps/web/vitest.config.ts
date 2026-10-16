import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // Les parcours de bout en bout vivent dans `tests/e2e` et ont leur propre
    // configuration (`vitest.e2e.config.ts`, script `test:e2e`) : ils montent
    // une fausse API sur `fetch` et n'ont pas à ralentir la suite unitaire.
    include: ["tests/unitaires/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
