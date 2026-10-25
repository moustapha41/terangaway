/**
 * La base de test, et la seule porte pour y toucher.
 *
 * Les tests d'intégration atteignaient la base de **développement** sans que
 * rien ne le dise. Aucun script, aucune configuration Vitest, aucun fichier de
 * préparation ne nomme `DATABASE_URL` : le chemin de `apps/api/.env` est
 * *compilé dans le client Prisma généré* (`relativeEnvPaths.schemaEnvPath`),
 * et son runtime le charge à chaque construction d'un `PrismaClient`. C'est
 * rétabli à chaque `prisma generate`, et c'est indépendant du lanceur.
 *
 * On ne peut donc pas se contenter de poser une variable : il faut **passer
 * l'URL au constructeur**, ce que ce module est seul à faire. Une URL explicite
 * l'emporte sur tout chargement d'environnement, quel qu'en soit l'ordre.
 *
 * Trois refus, et aucun n'est négociable :
 *
 *   `DATABASE_URL_TEST` absente — rien ne démarre, et surtout rien ne se
 *   rabat sur `DATABASE_URL` ni sur `apps/api/.env` ;
 *
 *   un nom de base différent de `teranga_test`, au caractère près. Pas
 *   « tout ce qui finit par `_test` » : `prod_test`, `teranga_2_test` ou une
 *   coquille passeraient, et c'est précisément le genre d'approximation qui
 *   fait écrire dans la mauvaise base ;
 *
 *   une cible qui est celle de `DATABASE_URL`, quand cette variable est là.
 *
 * **Aucune URL, aucun identifiant, aucun mot de passe ne sort d'ici.** Les
 * messages d'erreur ne nomment que la variable fautive et, au plus, le nom de
 * la base lue. Un message d'erreur finit dans un journal, et un journal se
 * relit.
 *
 * Ce module ne nettoie rien et ne connecte rien : construire le client n'ouvre
 * aucune connexion — Prisma se connecte à la première requête, ou sur
 * `$connect()` explicite, que chaque test appelle lui-même. Aucun `TRUNCATE`,
 * aucune remise à zéro : un nettoyage qui part tout seul au lancement d'une
 * suite est un nettoyage qui, le jour où la cible est mauvaise, efface la
 * mauvaise base.
 *
 * **Réservé aux tests** : rien dans `src` ne doit l'importer, comme
 * `commun/securite/posture.test-utils.ts`. Il vit sous `src` et non sous
 * `test/` pour une raison mécanique : `tsconfig.json` fixe
 * `rootDir: "./src"` et exclut `test`, si bien qu'un fichier de test importé
 * depuis `test/` fait échouer la compilation sur TS6059.
 */
import { PrismaService } from "./prisma.service";

/** Le seul nom de base accepté, au caractère près. */
export const NOM_BASE_DE_TEST = "teranga_test";

/** La variable qui désigne la base de test. Jamais de valeur de repli. */
export const VARIABLE_BASE_DE_TEST = "DATABASE_URL_TEST";

/**
 * Une cible refusée. Le nom de la classe suffit à la reconnaître dans un
 * rapport de test, sans avoir à lire le message.
 */
export class CibleDeTestRefusee extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CibleDeTestRefusee";
  }
}

/**
 * Ce qu'on retient d'une URL de connexion : de quoi comparer deux cibles, et
 * rien qui puisse être recopié dans un journal.
 */
export interface CibleBase {
  /** Le nom de la base. C'est la seule part qu'on s'autorise à afficher. */
  base: string;
}

/**
 * Le nom de base porté par une URL de connexion.
 *
 * L'URL n'est jamais rendue, ni journalisée, ni incluse dans une erreur : seule
 * cette miette en ressort.
 */
function decrire(url: string, nomVariable: string): CibleBase {
  let analysee: URL;
  try {
    analysee = new URL(url);
  } catch {
    throw new CibleDeTestRefusee(
      `${nomVariable} n'est pas une URL de connexion lisible. ` +
        "Forme attendue : postgresql://<utilisateur>:<secret>@<hôte>:<port>/" +
        `${NOM_BASE_DE_TEST}?schema=public`,
    );
  }

  const base = decodeURIComponent(analysee.pathname.replace(/^\//, ""));
  if (!base) {
    throw new CibleDeTestRefusee(`${nomVariable} ne désigne aucune base de données.`);
  }
  return { base };
}

/** Comme `decrire`, mais rend `undefined` plutôt que de lever. */
function decrireOuRien(url: string, nomVariable: string): CibleBase | undefined {
  try {
    return decrire(url, nomVariable);
  } catch {
    return undefined;
  }
}

/**
 * L'URL de la base de test, vérifiée — ou une erreur avant toute connexion.
 *
 * À appeler le plus tôt possible : la configuration d'intégration s'en sert au
 * chargement, donc avant qu'aucun fichier de test ne soit lu, et la fabrique la
 * rappelle pour qu'aucun test ne puisse la contourner.
 */
export function cibleDeTestVerifiee(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  cible: CibleBase;
} {
  const brute = env[VARIABLE_BASE_DE_TEST]?.trim();

  if (!brute) {
    throw new CibleDeTestRefusee(
      `${VARIABLE_BASE_DE_TEST} est absente : les tests d'intégration ne démarrent pas.\n` +
        `  Ils n'utilisent jamais DATABASE_URL ni apps/api/.env — ce serait écrire dans la base de développement.\n` +
        `  Posez ${VARIABLE_BASE_DE_TEST} vers la base « ${NOM_BASE_DE_TEST} », puis relancez.\n` +
        "  Voir docs/05-exploitation/runbooks/base-de-test-postgres.md",
    );
  }

  const cible = decrire(brute, VARIABLE_BASE_DE_TEST);

  if (cible.base !== NOM_BASE_DE_TEST) {
    throw new CibleDeTestRefusee(
      `${VARIABLE_BASE_DE_TEST} désigne la base « ${cible.base} », et seule ` +
        `« ${NOM_BASE_DE_TEST} » est acceptée.\n` +
        "  Le nom doit correspondre au caractère près : un nom qui se termine par « _test »\n" +
        "  ne suffit pas, parce qu'une coquille en porte un aussi.",
    );
  }

  // Le garde-fou de dernier recours : si quelqu'un a fait pointer la base de
  // développement sur la base de test — ou l'inverse — les deux variables
  // désignent la même cible, et la séparation n'existe plus. On refuse plutôt
  // que de croire au nom.
  const developpement = env.DATABASE_URL?.trim();
  if (developpement) {
    const cibleDev = decrireOuRien(developpement, "DATABASE_URL");
    if (cibleDev && cibleDev.base === cible.base) {
      throw new CibleDeTestRefusee(
        `${VARIABLE_BASE_DE_TEST} et DATABASE_URL désignent la même base ` +
          `(« ${cible.base} ») : il n'y aurait aucune isolation.`,
      );
    }
  }

  return { url: brute, cible };
}

/**
 * Le client Prisma des tests d'intégration.
 *
 * L'URL est passée au **constructeur**, et c'est tout l'intérêt : elle
 * l'emporte sur le `.env` que le client généré charge de son côté, sans
 * dépendre de l'ordre des imports.
 *
 * Ne connecte pas : `$connect()` reste à l'appelant, comme aujourd'hui.
 */
export function creerPrismaDeTest(env: NodeJS.ProcessEnv = process.env): PrismaService {
  const { url } = cibleDeTestVerifiee(env);
  return new PrismaService({ datasources: { db: { url } } });
}
