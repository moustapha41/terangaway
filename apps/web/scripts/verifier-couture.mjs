/**
 * Vérifie qu'aucun écran ne lit le catalogue en direct.
 *
 * Tout doit passer par `mocks/api.ts`, la couture : c'est elle qui bascule
 * vers l'API domaine par domaine. Un composant qui importe les fixtures
 * continue d'afficher des données figées une fois le serveur branché — et
 * personne ne le voit, jusqu'à ce qu'un visiteur clique.
 *
 * C'est ainsi que les quatre cartes de la page d'accueil ont mené à des 404
 * pendant des jours, et que l'écran de résultats transport répondait encore
 * alors que l'API était éteinte.
 *
 * La liste `ATTENDUS` recense ce qui n'est pas encore convertible, avec la
 * raison. Elle doit diminuer, jamais grandir.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Fichiers encore autorisés à lire les fixtures, et pourquoi. */
const ATTENDUS = new Map([
  // L'espace prestataire n'a pas encore d'API : ses 16 fonctions de couture
  // sont toutes en mock. À reprendre avec cette colonne.
  ["src/app/(langue)/[locale]/(prestataire)/prestataire/avis/page.tsx", "espace prestataire"],
  ["src/app/(langue)/[locale]/(prestataire)/prestataire/connexion/page.tsx", "espace prestataire"],
  ["src/app/(langue)/[locale]/(prestataire)/prestataire/offres/page.tsx", "espace prestataire"],
  ["src/components/prestataire/onglets-offre.tsx", "espace prestataire"],
  ["src/features/prestataire/gestion-disponibilites.tsx", "espace prestataire"],
  ["src/features/prestataire/gestion-photos.tsx", "espace prestataire"],
  ["src/features/prestataire/actions.ts", "espace prestataire"],
  ["src/features/prestataire/session.ts", "espace prestataire"],
  // Composants client : ils ne peuvent pas appeler la couture, qui est
  // serveur. Leur parent devra leur passer les données en propriétés.
  ["src/components/recherche/barre-de-recherche.tsx", "composant client, à alimenter par propriétés"],
  ["src/features/transport/barre-recherche-transport.tsx", "composant client, à alimenter par propriétés"],
  // Les favoris sont stockés sur l'appareil : résoudre une liste d'identifiants
  // demande un point d'entrée que l'API n'a pas encore.
  ["src/app/(langue)/[locale]/(visiteur)/compte/favoris/page.tsx", "favoris : résolution par liste d'identifiants à créer"],
]);

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

const trouves = fichiers("src").filter(
  (chemin) =>
    !chemin.startsWith("src/mocks/") &&
    /from\s+"@\/mocks\/fixtures/.test(readFileSync(chemin, "utf8")),
);

const nouveaux = trouves.filter((c) => !ATTENDUS.has(c));
const partis = [...ATTENDUS.keys()].filter((c) => !trouves.includes(c));

if (nouveaux.length > 0) {
  console.error(`✗ ${nouveaux.length} écran(s) lisent le catalogue hors de la couture :\n`);
  for (const c of nouveaux) console.error(`    ${c}`);
  console.error("\n  Passez par `mocks/api.ts` : c'est elle qui bascule vers l'API.");
  process.exit(1);
}

console.log(`✓ couture respectée (${trouves.length} exception(s) connue(s))`);
for (const [chemin, raison] of ATTENDUS) {
  if (trouves.includes(chemin)) console.log(`    ${raison.padEnd(44)} ${chemin.replace("src/", "")}`);
}
if (partis.length > 0) {
  console.log(`\n  ${partis.length} exception(s) devenue(s) inutile(s), à retirer de la liste :`);
  for (const c of partis) console.log(`    ${c}`);
}
