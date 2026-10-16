import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Parcours de bout en bout, en processus.
 *
 * Ils traversent la vraie chaîne du site — Server Action, session, client HTTP,
 * jusqu'à `fetch` — contre une fausse API montée dans le test. Ce n'est pas un
 * test navigateur : il ne dit rien du rendu, du JavaScript client ni des
 * erreurs de console. Il dit en revanche ce qui a cassé en production, que les
 * tests unitaires ne voyaient pas : le jeton de session n'était pas transmis à
 * l'API, et la réservation n'était rattachée à aucun compte.
 *
 * Un test navigateur (Playwright) reste à faire ; il demande une dépendance et
 * des binaires qui ne sont pas dans le dépôt.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
