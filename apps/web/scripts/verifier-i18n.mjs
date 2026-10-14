/**
 * Vérifie que les trois catalogues ont exactement les mêmes clés, et que chaque
 * pluriel a les formes que sa langue exige.
 *
 * Le français est la référence. Une clé qui manque ailleurs est une erreur, pas
 * un avertissement : « aucun écran n'est validé dans une seule langue » (§A.8).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const messages = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "messages");
const LANGUES = ["fr", "en", "es"];
const REFERENCE = "fr";

const lire = (l) => JSON.parse(readFileSync(join(messages, `${l}.json`), "utf8"));

/** Aplatit en chemins ; un nœud de pluriel est une feuille, repéré par ses formes. */
function aplatir(noeud, prefixe = "", sortie = new Map()) {
  for (const [cle, valeur] of Object.entries(noeud)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (typeof valeur === "string") {
      sortie.set(chemin, "texte");
    } else if (valeur && typeof valeur === "object") {
      const formes = Object.keys(valeur);
      const estPluriel = formes.every((f) =>
        ["zero", "one", "two", "few", "many", "other"].includes(f),
      );
      if (estPluriel) sortie.set(chemin, "pluriel");
      else aplatir(valeur, chemin, sortie);
    }
  }
  return sortie;
}

const reference = aplatir(lire(REFERENCE));
let fautes = 0;

for (const langue of LANGUES) {
  if (langue === REFERENCE) continue;
  const actuel = aplatir(lire(langue));

  for (const [chemin, genre] of reference) {
    if (!actuel.has(chemin)) {
      console.error(`✗ ${langue}: clé manquante « ${chemin} »`);
      fautes++;
    } else if (actuel.get(chemin) !== genre) {
      console.error(`✗ ${langue}: « ${chemin} » est ${actuel.get(chemin)}, attendu ${genre}`);
      fautes++;
    }
  }
  for (const chemin of actuel.keys()) {
    if (!reference.has(chemin)) {
      console.error(`✗ ${langue}: clé en trop « ${chemin} »`);
      fautes++;
    }
  }
}

/**
 * `one` et `other` sont obligatoires : sans elles, rien ne s'affiche correctement.
 *
 * Les autres catégories de la langue — `many` en français et en espagnol, qui ne
 * sert qu'au-delà du million — sont seulement signalées : le traducteur se rabat
 * sur `other`, ce qui est juste pour des voyageurs, des chambres ou des avis.
 * Exiger une forme qui ne s'affichera jamais ferait du bruit à chaque nouvelle clé.
 */
const notes = [];
for (const langue of LANGUES) {
  const catalogue = lire(langue);
  const presentes = new Set(new Intl.PluralRules(langue).resolvedOptions().pluralCategories);
  for (const [chemin, genre] of aplatir(catalogue)) {
    if (genre !== "pluriel") continue;
    const noeud = chemin.split(".").reduce((n, c) => n[c], catalogue);
    for (const categorie of ["one", "other"]) {
      if (!(categorie in noeud)) {
        console.error(`✗ ${langue}: « ${chemin} » n'a pas la forme obligatoire « ${categorie} »`);
        fautes++;
      }
    }
    for (const categorie of presentes) {
      if (categorie !== "one" && categorie !== "other" && !(categorie in noeud)) {
        notes.push(`  ${langue} · ${chemin} · ${categorie}`);
      }
    }
  }
}

if (fautes) {
  console.error(`\n${fautes} problème(s) de traduction.`);
  process.exit(1);
}
console.log(`✓ ${LANGUES.length} catalogues, ${reference.size} clés, tout concorde`);
if (notes.length) {
  console.log(`\nFormes de pluriel non remplies, repli sur « other » (sans gravité) :`);
  console.log(notes.join("\n"));
}
