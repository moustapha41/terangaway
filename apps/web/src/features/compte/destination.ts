import { LANGUES, type Langue } from "@/lib/i18n/langues";

/**
 * Où renvoyer quelqu'un après une connexion ou une vérification.
 *
 * Le paramètre `suite` vient de l'URL : il est fourni par le navigateur, donc
 * par n'importe qui. Une redirection qui lui fait confiance est une redirection
 * ouverte — on envoie un lien `…/connexion?suite=https://sitemechant.example`,
 * la personne se connecte vraiment sur Teranga Way, et se retrouve sur une
 * copie du site qui lui redemande ses identifiants.
 *
 * La règle est donc une liste blanche de formes, et non une liste noire de
 * caractères : seul un chemin interne commençant par `/` est accepté, et tout
 * le reste tombe sur la destination par défaut.
 */
const DESTINATION_PAR_DEFAUT = "/compte";

/** Les préfixes de langue, sous la forme exacte où ils apparaissent dans un chemin. */
const PREFIXES = LANGUES.map((langue) => `/${langue}`);

/**
 * Ce chemin porte-t-il déjà un préfixe de langue ?
 *
 * La comparaison est exacte, segment par segment : `/fr` et `/fr/compte` en
 * portent un, `/france` n'en porte pas. Le test naïf `startsWith("/fr")`
 * répondait oui pour `/france`, et le chemin ressortait sans préfixe.
 */
function aUnPrefixeDeLangue(chemin: string): boolean {
  return PREFIXES.some((prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`));
}

/**
 * Une destination interne sûre, préfixée par la langue.
 *
 * Refuse tout ce qui pourrait sortir du site :
 *   · une URL absolue (`https://…`, `//serveur`, `javascript:`) ;
 *   · un chemin protocole-relatif, y compris écrit avec des antislashs
 *     (`/\serveur` et `\\serveur`, que certains navigateurs normalisent en `//`) ;
 *   · une valeur vide ou qui ne commence pas par `/`.
 */
export function resoudreDestination(suite: string | undefined | null, langue: Langue = "fr"): string {
  const propre = (suite ?? "").trim();

  const interne =
    propre.startsWith("/") &&
    !propre.startsWith("//") &&
    // `\` est traité comme `/` par plusieurs navigateurs : `/\evil.example`
    // devient `//evil.example`, donc une URL absolue.
    !propre.startsWith("/\\") &&
    !propre.includes("\\") &&
    // Un saut de ligne dans un en-tête `Location` permettrait d'en injecter un autre.
    !/[\r\n]/.test(propre);

  const cible = interne ? propre : DESTINATION_PAR_DEFAUT;

  return aUnPrefixeDeLangue(cible) ? cible : `/${langue}${cible}`;
}
