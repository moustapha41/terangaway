import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // Les tests parcourent les chemins de démonstration (compte
      // `visiteur-demo`, `codeDemo` renvoyé par `envoyerOtp`, dépôts en
      // mémoire). Ces raccourcis sont désormais à refus par défaut, il faut
      // donc les réclamer explicitement ici — exactement comme un poste de
      // développement doit le faire.
      //
      // Les tests de sécurité qui vérifient le refus remettent le verrou
      // eux-mêmes, par `avecComptesDemo(false)`.
      AUTORISER_COMPTES_DEMO: "true",
    },
  },
});
