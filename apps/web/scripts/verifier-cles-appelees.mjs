/**
 * Vérifie que chaque clé appelée par `t("…")` existe dans le catalogue.
 *
 * `verifier-i18n` contrôle que les trois langues portent **les mêmes** clés ;
 * il ne voit pas qu'une clé appelée n'existe nulle part. C'est ainsi que
 * « services.logementsTitre » s'est affiché tel quel sur la page d'accueil.
 *
 * Les clés construites — `t(`services.${cle}Titre`)` — sont résolues en
 * cherchant les valeurs littérales que la variable peut prendre dans le même
 * fichier. Quand on n'y arrive pas, on le dit plutôt que de se taire.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CATALOGUE = JSON.parse(readFileSync("src/messages/fr.json", "utf8"));

const aplatir = (objet, prefixe = "") =>
  Object.entries(objet).flatMap(([cle, valeur]) => {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    // Les formes de pluriel { one, other } sont une feuille, pas une branche.
    if (valeur && typeof valeur === "object" && !("other" in valeur)) {
      return aplatir(valeur, chemin);
    }
    return [chemin];
  });

const CONNUES = new Set(aplatir(CATALOGUE));

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

const manquantes = [];
const indecidables = [];

for (const chemin of fichiers("src")) {
  const source = readFileSync(chemin, "utf8");

  // 1. Clés littérales : t("a.b.c")
  for (const [, cle] of source.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
    if (!CONNUES.has(cle)) manquantes.push({ chemin, cle });
  }

  // 2. Clés construites : t(`prefixe.${variable}suffixe`)
  //
  //    La difficulté est de savoir d'où vient la variable. Un fichier contient
  //    souvent plusieurs tableaux de `cle:` qui nourrissent des préfixes
  //    différents ; prendre toutes les valeurs du fichier mélange tout.
  //
  //    On remonte donc au tableau : `GARANTIES.map((garantie) => …)` relie la
  //    racine « garantie » au tableau GARANTIES, dont on lit les valeurs.
  const tableauxParRacine = new Map();
  for (const [, nomTableau, racine] of source.matchAll(
    /\b([A-Za-z_$][\w$]*)\s*\.\s*(?:filter\([^)]*\)\s*\.\s*)?map\(\s*\(?\s*([A-Za-z_$][\w$]*)/g,
  )) {
    tableauxParRacine.set(racine, nomTableau);
  }

  /** Les valeurs littérales que porte un tableau nommé, dans ce fichier. */
  function valeursDuTableau(nom, feuille) {
    const declaration = new RegExp(`\\b(?:const|let|var)\\s+${nom}\\b[^=]*=\\s*\\[`, "g");
    const depart = declaration.exec(source);
    if (!depart) return null;
    // On lit jusqu'au crochet fermant correspondant.
    let profondeur = 0;
    let i = depart.index + depart[0].length - 1;
    for (; i < source.length; i++) {
      if (source[i] === "[") profondeur++;
      else if (source[i] === "]") {
        profondeur--;
        if (profondeur === 0) break;
      }
    }
    const bloc = source.slice(depart.index, i + 1);
    const parCle = [...bloc.matchAll(new RegExp(`\\b${feuille}\\s*:\\s*"([^"]+)"`, "g"))].map(
      (m) => m[1],
    );
    if (parCle.length > 0) return parCle;
    // Tableau de chaînes nues : ["a", "b", "c"]
    const nues = [...bloc.matchAll(/"([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
    return nues.length > 0 ? nues : null;
  }

  for (const [, prefixe, variable, suffixe] of source.matchAll(
    /\bt\(\s*`([a-zA-Z0-9_.]*)\$\{([^}]+)\}([a-zA-Z0-9_.]*)`/g,
  )) {
    const motif = `${prefixe}\${${variable}}${suffixe}`;
    const morceaux = variable.trim().split(".");
    const racine = morceaux[0];
    const feuille = morceaux.length > 1 ? morceaux[morceaux.length - 1] : null;

    const nomTableau = tableauxParRacine.get(racine);
    const valeurs = nomTableau ? valeursDuTableau(nomTableau, feuille ?? "cle") : null;

    if (!valeurs) {
      // Variable d'état, valeur venue d'un import, expression quelconque : on
      // ne peut pas trancher d'ici, et on le dit plutôt que de se taire.
      indecidables.push({ chemin, motif });
      continue;
    }

    for (const valeur of valeurs) {
      const cle = `${prefixe}${valeur}${suffixe}`;
      if (!CONNUES.has(cle)) manquantes.push({ chemin, cle, construite: true });
    }
  }
}

if (manquantes.length > 0) {
  console.error(`✗ ${manquantes.length} clé(s) appelée(s) mais absente(s) du catalogue :\n`);
  for (const { chemin, cle, construite } of manquantes) {
    console.error(`  ${cle}${construite ? "  (construite)" : ""}\n    ${chemin}`);
  }
  process.exit(1);
}

console.log(`✓ toutes les clés appelées existent (${CONNUES.size} clés au catalogue)`);
if (indecidables.length > 0) {
  console.log(`  ${indecidables.length} clé(s) construite(s) non résolue(s), à l'œil :`);
  for (const { chemin, motif } of indecidables) console.log(`    ${motif}  —  ${chemin}`);
}
