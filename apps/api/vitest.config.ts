import { defineConfig } from "vitest/config";

/**
 * Les tests de l'API **sans base de données**.
 *
 * C'est la suite par défaut : `pnpm test`, à la racine comme ici, ne touche
 * jamais PostgreSQL. Ce n'était pas le cas — les onze fichiers d'intégration
 * étaient ramassés avec les autres et écrivaient dans la base de
 * développement, sans que rien ne le dise ni ne le nettoie.
 *
 * L'exclusion est **nominale**, et c'est voulu : deux de ces fichiers ne
 * portent pas le suffixe `.prisma.test.ts` — `comptes.resend.test.ts` et
 * `securite-posture.test.ts` — et un filtre par nom de fichier les aurait
 * laissés passer. Un motif aurait l'air plus propre et serait faux.
 *
 * Rien ici ne nomme `DATABASE_URL` ni `DATABASE_URL_TEST`, et rien ne doit le
 * faire : ces tests n'ont aucune base vers laquelle retomber.
 *
 * L'invariant à tenir quand un test est ajouté : tout fichier qui construit un
 * client Prisma doit figurer dans la liste ci-dessous **et** dans
 * `vitest.integration.config.ts`. Pour le vérifier :
 *
 *   grep -rln "creerPrismaDeTest\|new PrismaService(" src --include="*.test.ts"
 */
export const TESTS_INTEGRATION = [
  "src/modules/acomptes/acomptes.prisma.test.ts",
  "src/modules/acomptes/acomptes.service.prisma.test.ts",
  "src/modules/comptes/comptes.prisma.test.ts",
  "src/modules/comptes/comptes.resend.test.ts",
  "src/modules/comptes/connexion-mot-de-passe.prisma.test.ts",
  "src/modules/comptes/inscription.prisma.test.ts",
  "src/modules/comptes/securite-posture.test.ts",
  "src/modules/demandes/coordonnees.prisma.test.ts",
  "src/modules/demandes/demandes.prisma.test.ts",
  "src/modules/demandes/transitions-concurrentes.prisma.test.ts",
  "src/modules/reponses/reponses.prisma.test.ts",
];

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // Large à l'inclusion, nominal à l'exclusion : un nouveau test unitaire est
    // ramassé sans qu'on y pense, un test d'intégration ne peut pas l'être par
    // inadvertance.
    include: ["src/**/*.test.ts"],
    exclude: TESTS_INTEGRATION,
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
