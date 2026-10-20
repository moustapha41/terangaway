/**
 * Les traductions du catalogue décrivent-elles bien les mêmes objets ?
 *
 * `photos` et `videos` suivent l'ordre du catalogue, position par position : un
 * tableau plus long que la série décrirait une photo qui n'existe pas, et un
 * tableau plus court laisserait les dernières en français sans qu'on le sache.
 * Les deux sont des fautes muettes à l'écran — d'où ce contrôle.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const lire = (nom) => readFileSync(join(ici, "..", "src", nom), "utf8");

const catalogue = lire("logements.ts");
const traductions = lire("logements.traductions.ts");

/** Compte, par fiche, les photos et les vidéos du catalogue français. */
function compterCatalogue() {
  const compte = {};
  const fiches = [...catalogue.matchAll(/\n {4}id: "(l-\d{3})",/g)];
  fiches.forEach((fiche, i) => {
    const fin = i + 1 < fiches.length ? fiches[i + 1].index : catalogue.length;
    const bloc = catalogue.slice(fiche.index, fin);
    compte[fiche[1]] = {
      photos: (bloc.match(/alt: "/g) ?? []).length,
      videos: (bloc.match(/legende: "/g) ?? []).length,
    };
  });
  return compte;
}

/** Compte les mêmes séries dans chaque table de traduction. */
function compterTraductions() {
  const tables = {};
  for (const langue of ["EN", "ES"]) {
    const debut = traductions.indexOf(`const ${langue}: Record<string, TraductionLogement> = {`);
    const fin = traductions.indexOf("\n};", debut);
    const corps = traductions.slice(debut, fin);
    const fiches = [...corps.matchAll(/\n {2}"(l-\d{3})": \{/g)];
    const compte = {};
    fiches.forEach((fiche, i) => {
      const f = i + 1 < fiches.length ? fiches[i + 1].index : corps.length;
      const bloc = corps.slice(fiche.index, f);
      const serie = (nom) => {
        const m = bloc.match(new RegExp(`${nom}: \\[([^\\]]*)\\]`, "s"));
        return m ? (m[1].match(/"/g) ?? []).length / 2 : null;
      };
      compte[fiche[1]] = { photos: serie("photos"), videos: serie("videos") };
    });
    tables[langue] = compte;
  }
  return tables;
}

const attendu = compterCatalogue();
const trouve = compterTraductions();
const fautes = [];
let series = 0;

for (const [langue, fiches] of Object.entries(trouve)) {
  for (const [id, compte] of Object.entries(fiches)) {
    if (!attendu[id]) {
      fautes.push(`${langue} ${id} : fiche inconnue du catalogue`);
      continue;
    }
    for (const serie of ["photos", "videos"]) {
      if (compte[serie] === null) continue;
      series += 1;
      if (compte[serie] !== attendu[id][serie]) {
        fautes.push(
          `${langue} ${id} ${serie} : ${compte[serie]} traductions pour ${attendu[id][serie]} éléments`,
        );
      }
    }
  }
}

if (fautes.length) {
  console.error("✗ traductions du catalogue désalignées :");
  for (const faute of fautes) console.error("   " + faute);
  process.exit(1);
}

const fiches = Object.keys(trouve.EN).length;
console.log(`✓ traductions du catalogue alignées (${fiches} fiches, ${series} séries, 2 langues)`);
