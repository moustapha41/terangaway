/**
 * Vérifie qu'aucun service n'importe le catalogue de démonstration.
 *
 * Tout le pari de « on garde les données mockées » tient à une règle :
 * `@teranga/fixtures` ne s'importe que dans un fichier `*.fixtures.ts`.
 * Partout ailleurs, on dépend d'un port.
 *
 * Sans ce contrôle, un import de confort se glisse dans un service un mardi,
 * et le jour de la bascule vers Postgres il faut rouvrir vingt fichiers.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return nom.endsWith(".ts") ? [chemin] : [];
  });
}

const fautifs = [];
for (const chemin of fichiers("src")) {
  if (chemin.endsWith(".fixtures.ts")) continue;
  const source = readFileSync(chemin, "utf8");
  if (/from\s+"@teranga\/fixtures/.test(source)) fautifs.push(chemin);
}

if (fautifs.length > 0) {
  console.error(
    `✗ ${fautifs.length} fichier(s) importent @teranga/fixtures hors d'un *.fixtures.ts :\n`,
  );
  for (const f of fautifs) console.error(`    ${f}`);
  console.error(
    "\n  Passez par un dépôt (voir src/commun/depots/README.md) : c'est ce qui\n" +
      "  permettra de brancher Postgres sans rouvrir les services.",
  );
  process.exit(1);
}

console.log("✓ aucun import direct du catalogue hors des implémentations de dépôt");
