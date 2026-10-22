/**
 * L'URL de la base de test : la dériver proprement, et la vérifier.
 *
 * Deux usages, et aucun n'ouvre de connexion :
 *
 *   deriver                  rend sur stdout l'URL de `teranga_test`, dérivée
 *                            de `DATABASE_URL` ;
 *   verifier <VARIABLE>      refuse si la variable ne cible pas exactement
 *                            `teranga_test`.
 *
 * Pourquoi un script plutôt qu'une substitution dans le shell : remplacer
 * « /teranga? » par « /teranga_test? » dans une chaîne casse dès que l'URL
 * change de forme — un mot de passe qui contient ce motif, un `?schema`
 * absent, un port omis. Et quand la substitution échoue, elle ne remplace
 * rien : on repart avec l'URL de développement, et la migration s'applique à
 * `teranga`. Ici le nom de base est un *champ* (`pathname`), pas une
 * sous-chaîne : il n'y a rien à rater.
 *
 * **Aucune URL ne paraît à l'écran.** `deriver` écrit l'URL sur stdout, pour
 * être capturée par `$(…)` ; tout le reste part sur stderr et ne nomme que des
 * bases. Un message d'erreur finit dans un journal, et un journal se relit.
 */
import { argv, env, exit, stderr, stdout } from "node:process";

const NOM_BASE_DE_TEST = "teranga_test";

/**
 * Les bases qu'on ne touche jamais, même par accident de frappe.
 * `teranga` est la base de développement ; les trois autres appartiennent au
 * cluster. Le contrôle du nom exact les exclut déjà — cette liste existe pour
 * que le message dise *pourquoi* on refuse.
 */
const BASES_INTERDITES = new Set(["teranga", "postgres", "template0", "template1"]);

function refuser(message) {
  stderr.write(`✗ ${message}\n`);
  exit(1);
}

/** Le nom de base porté par une URL. L'URL elle-même ne ressort jamais d'ici. */
function analyser(brute, nomVariable) {
  let url;
  try {
    url = new URL(brute);
  } catch {
    refuser(
      `${nomVariable} n'est pas une URL de connexion lisible : son identité ` +
        "n'est pas vérifiable, on ne s'en sert pas.",
    );
  }
  const base = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!base) refuser(`${nomVariable} ne désigne aucune base de données.`);
  return { url, base };
}

function deriver() {
  const brute = env.DATABASE_URL?.trim();
  if (!brute) {
    refuser(
      "DATABASE_URL est absente : rien à dériver.\n" +
        "  Chargez-la d'abord : cd apps/api && set -a && . ./.env && set +a",
    );
  }

  const { url, base } = analyser(brute, "DATABASE_URL");
  if (base === NOM_BASE_DE_TEST) {
    refuser(
      `DATABASE_URL désigne déjà « ${NOM_BASE_DE_TEST} » : développement et ` +
        "test seraient confondus, il n'y aurait aucune isolation.",
    );
  }

  // Modification structurée : on remplace le champ, pas une sous-chaîne.
  // Utilisateur, mot de passe, hôte, port et paramètres sont conservés par le
  // parseur — aucune recomposition à la main.
  url.pathname = `/${NOM_BASE_DE_TEST}`;

  stderr.write(`✓ URL dérivée de DATABASE_URL : « ${base} » → « ${NOM_BASE_DE_TEST} »\n`);
  stdout.write(url.toString());
}

function verifier(nomVariable) {
  if (!nomVariable) refuser("Usage : verifier <NOM_DE_VARIABLE>");

  const brute = env[nomVariable]?.trim();
  if (!brute) refuser(`${nomVariable} est absente : aucune opération ne part sans elle.`);

  const { base } = analyser(brute, nomVariable);

  if (BASES_INTERDITES.has(base)) {
    refuser(
      `${nomVariable} désigne « ${base} », qui ne doit jamais être la cible ` +
        "d'une opération de test.",
    );
  }
  if (base !== NOM_BASE_DE_TEST) {
    refuser(
      `${nomVariable} désigne « ${base} » ; seule « ${NOM_BASE_DE_TEST} » est ` +
        "acceptée, au caractère près — un nom qui finit par « _test » ne suffit pas.",
    );
  }

  const developpement = env.DATABASE_URL?.trim();
  if (developpement) {
    let baseDev;
    try {
      baseDev = decodeURIComponent(new URL(developpement).pathname.replace(/^\//, ""));
    } catch {
      baseDev = undefined;
    }
    if (baseDev === base) {
      refuser(
        `${nomVariable} et DATABASE_URL désignent la même base (« ${base} ») : ` +
          "il n'y aurait aucune isolation.",
      );
    }
  }

  stderr.write(`✓ ${nomVariable} cible bien « ${NOM_BASE_DE_TEST} »\n`);
}

const [, , commande, argument] = argv;
if (commande === "deriver") deriver();
else if (commande === "verifier") verifier(argument);
else refuser("Usage : base-de-test.mjs deriver | verifier <NOM_DE_VARIABLE>");
