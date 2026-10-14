/**
 * Génère src/theme.css et src/index.ts depuis src/tokens.json.
 * Ces deux fichiers ne s'écrivent jamais à la main : `pnpm -F @teranga/tokens generer`.
 * Avec --verifier, échoue si le disque ne correspond plus au JSON (utile en CI).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const t = JSON.parse(readFileSync(join(src, "tokens.json"), "utf8"));
const verifier = process.argv.includes("--verifier");

const ENTETE = `/* Généré par scripts/generer.mjs depuis tokens.json. Ne pas modifier à la main. */\n`;

const val = (o) => (typeof o === "string" ? o : o.value);

/**
 * Les clés de tokens.json gardent les noms du dossier de conception §C.1, pour que
 * la traçabilité tienne. Les variables CSS prennent des noms français, comme le
 * reste du projet : on écrit `text-encre-douce`, pas `text-text-muted`.
 */
const NOM_FR = {
  primary: "primaire", success: "succes", warning: "alerte", danger: "danger",
  accent: "accent", text: "encre", "text-muted": "encre-douce", border: "contour", "border-control": "contour-champ",
  surface: "surface", background: "page", field: "champ",
  blue: "bleu", green: "vert", orange: "orange", red: "rouge", yellow: "jaune", grey: "gris",
};
const fr = (n) => NOM_FR[n] ?? n;
const lignes = [];
const titre = (s) => lignes.push(``, `  /* ${s} */`);

titre("Couleurs — dossier de conception §C.1");
for (const [nom, o] of Object.entries(t.color)) lignes.push(`  --color-${fr(nom)}: ${val(o)};`);

titre("Teintes de fond des badges et bandeaux");
for (const [nom, o] of Object.entries(t["color-tint"])) lignes.push(`  --color-teinte-${fr(nom)}: ${val(o)};`);

titre("Couche accueil — relevé sur base/maquette.png");
for (const [nom, o] of Object.entries(t.accueil)) {
  if (nom.startsWith("$")) continue;
  lignes.push(`  --color-${nom}: ${val(o)};`);
}

// Pas de --spacing-* : dans Tailwind v4 cet espace de noms pilote l'échelle entière.
// Les 7 valeurs du dossier (4·8·12·16·24·32·48 px) sont déjà celles de Tailwind,
// aux indices 1·2·3·4·6·8·12. Correspondance notée dans le README.

titre("Rayons");
for (const [n, v] of Object.entries(t.radius)) lignes.push(`  --radius-${n}: ${v};`);

titre("Hauteurs minimales");
for (const [n, v] of Object.entries(t.size)) lignes.push(`  --size-${n}: ${v};`);

titre("Typographie");
lignes.push(`  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;`);
for (const [nom, s] of Object.entries(t.typography.styles)) {
  lignes.push(`  --text-${nom}: ${s.taille};`);
  lignes.push(`  --text-${nom}--line-height: ${s.interligne};`);
  lignes.push(`  --text-${nom}--font-weight: ${s.graisse};`);
}

titre("Mouvement — désactivé si le téléphone demande moins d'animations");
for (const [n, v] of Object.entries(t.motion)) lignes.push(`  --duree-${n}: ${v};`);

titre("Graphiques — palette validée pour le daltonisme");
for (const [nom, o] of Object.entries(t.graphique)) {
  if (nom.startsWith("$")) continue;
  lignes.push(`  --color-graphe-${nom}: ${val(o)};`);
}

titre("Ombre");
for (const [n, o] of Object.entries(t.ombre)) lignes.push(`  --shadow-${n}: ${val(o)};`);

titre("Points de rupture — grille §C.2");
for (const [nom, g] of Object.entries(t.grille)) lignes.push(`  --breakpoint-${nom}: ${g.reference};`);

const css = `${ENTETE}\n/* static : les jetons restent tous déclarés, même ceux qu’aucune classe n’emploie\n   encore — un design system qui disparaît selon l’usage est un piège. */\n@theme static {${lignes.join("\n")}\n}\n`;

const statuts = Object.entries(t.statut)
  .map(([cle, s]) => `  ${cle}: { icone: "${s.icone}", couleur: "${fr(s.couleur)}", libelle: "${s.libelle}" },`)
  .join("\n");

const ts = `${ENTETE}
import tokens from "./tokens.json" with { type: "json" };

export { tokens };

export const STATUTS = {
${statuts}
} as const;

export type Statut = keyof typeof STATUTS;

/** Ordre d'avancement d'une demande ; les statuts terminaux ne sont pas dans la frise. */
export const FRISE: readonly Statut[] = ["envoyee", "acceptee", "confirmee", "terminee"];
export const STATUTS_TERMINAUX: readonly Statut[] = ["terminee", "refusee", "expiree", "annulee"];
`;

let ecart = false;
for (const [fichier, contenu] of [["theme.css", css], ["index.ts", ts]]) {
  const chemin = join(src, fichier);
  if (verifier) {
    let actuel = "";
    try { actuel = readFileSync(chemin, "utf8"); } catch {}
    if (actuel !== contenu) { console.error(`✗ ${fichier} ne correspond plus à tokens.json`); ecart = true; }
  } else {
    writeFileSync(chemin, contenu);
    console.log(`✓ src/${fichier}`);
  }
}
if (verifier && ecart) process.exit(1);
if (verifier) console.log("✓ jetons à jour");
