/**
 * Contrôle de contraste — critère de fin §D.4 : « tous les textes et icônes
 * passent le contrôle de contraste avec un outil ».
 *
 * §C.6 fixe les seuils : 4,5 pour le texte, 3 pour les icônes et les contours.
 *
 * `color.border` n'y figure pas : c'est une séparation décorative entre cartes,
 * pas la limite d'un élément de saisie. Les contours de champs utilisent
 * `color.border-control`, qui est là précisément pour tenir le seuil.
 * Les paires testées sont celles que les écrans emploient réellement ; une paire
 * qui n'existe nulle part n'a pas besoin de passer.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const jetons = JSON.parse(
  readFileSync(join(racine, "packages", "tokens", "src", "tokens.json"), "utf8"),
);

const C = Object.fromEntries(Object.entries(jetons.color).map(([n, o]) => [n, o.value]));
const T = Object.fromEntries(Object.entries(jetons["color-tint"]).map(([n, o]) => [n, o.value]));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** [description, premier plan, fond, seuil] */
const PAIRES = [
  ["Texte courant sur page", C.text, C.background, 4.5],
  ["Texte courant sur carte", C.text, C.surface, 4.5],
  ["Texte secondaire sur page", C["text-muted"], C.background, 4.5],
  ["Texte secondaire sur carte", C["text-muted"], C.surface, 4.5],
  ["Texte secondaire sur champ", C["text-muted"], C.field, 4.5],
  ["Bouton principal", "#FFFFFF", C.primary, 4.5],
  ["Bouton confirmation", "#FFFFFF", C.success, 4.5],
  ["Bouton secondaire", C.primary, C.surface, 4.5],
  ["Bouton danger", C.danger, C.surface, 4.5],
  ["Lien sur page", C.primary, C.background, 4.5],
  ["Badge vérifié", C.primary, T.blue, 4.5],
  ["Badge statut envoyée", C.warning, T.orange, 4.5],
  ["Badge statut acceptée", C.success, T.green, 4.5],
  ["Badge statut refusée", C.danger, T.red, 4.5],
  ["Badge statut expirée", C["text-muted"], T.grey, 4.5],
  ["Bandeau information", C.primary, T.blue, 4.5],
  ["Bandeau avertissement", C.warning, T.orange, 4.5],
  ["Bandeau erreur", C.danger, T.red, 4.5],
  ["Erreur sous un champ", C.danger, C.surface, 4.5],
  ["Contour de champ sur carte", C["border-control"], C.surface, 3],
  ["Contour de champ sur page", C["border-control"], C.background, 3],
  ["Contour de champ sur champ", C["border-control"], C.field, 3],
  ["Icône secondaire sur carte", C["text-muted"], C.surface, 3],
  ["Accent décoratif sur nuit", C.accent, C.primary, 3],
];

let echecs = 0;
console.log("Contraste (seuil §C.6)\n");
for (const [nom, avant, arriere, seuil] of PAIRES) {
  const ratio = contraste(avant, arriere);
  const ok = ratio >= seuil;
  if (!ok) echecs++;
  console.log(
    `${ok ? "✓" : "✗"} ${nom.padEnd(34)} ${ratio.toFixed(2).padStart(5)} : 1   (min ${seuil})`,
  );
}

console.log();
if (echecs) {
  console.error(`${echecs} paire(s) sous le seuil.`);
  process.exit(1);
}
console.log(`✓ ${PAIRES.length} paires, toutes au-dessus du seuil`);
