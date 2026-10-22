import { defineConfig } from "vitest/config";

import { cibleDeTestVerifiee } from "./src/base-de-donnees/base-de-test.test-utils";
import { TESTS_INTEGRATION } from "./vitest.config";

/**
 * Les tests d'intégration PostgreSQL, et eux seuls.
 *
 * Ils ne sont **pas** branchés sur `pnpm test` : ils se lancent par
 * `pnpm -F @teranga/api test:integration`, et aucune tâche Turbo ne les
 * appelle. Depuis la racine, `pnpm test` ne peut donc pas les atteindre.
 *
 * La cible est vérifiée **au chargement de cette configuration**, c'est-à-dire
 * avant qu'aucun fichier de test ne soit lu et avant qu'aucun client Prisma ne
 * soit construit. Sans `DATABASE_URL_TEST`, ou vers une autre base que
 * `teranga_test`, la suite ne démarre pas : elle s'arrête ici, sur un message
 * qui dit quoi poser. La fabrique revérifie de son côté — un test ne peut pas
 * contourner la configuration.
 *
 * Aucun `globalSetup`, et rien qui nettoie : pour cette étape, la suite
 * n'efface rien. Un nettoyage qui s'enclenche tout seul au lancement efface la
 * mauvaise base le jour où la cible est mauvaise, et c'est exactement ce qu'on
 * cherche à rendre impossible.
 */
cibleDeTestVerifiee();

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: TESTS_INTEGRATION,
    // Une seule base pour onze fichiers : en parallèle, ils se marcheraient
    // dessus. `visiteur-demo` est un identifiant fixe partagé par neuf
    // d'entre eux, et la relance de `demandes.prisma.test.ts` dépend du nombre
    // de demandes en attente — deux fichiers simultanés fausseraient le
    // résultat sans rien casser, ce qui est le pire des cas.
    fileParallelism: false,
    env: {
      // Même posture que la suite unitaire : ces tests parcourent les chemins
      // de démonstration et les réclament explicitement.
      AUTORISER_COMPTES_DEMO: "true",
    },
  },
});
