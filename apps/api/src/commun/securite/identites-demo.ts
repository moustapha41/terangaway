/**
 * L'identité de démonstration, nommée une seule fois.
 *
 * `visiteur-demo` est une chaîne publique : elle est écrite dans le dépôt, dans
 * la documentation, et n'importe qui peut la poser dans un cookie. Ce n'est donc
 * pas un jeton, et aucun code ne doit la traiter comme tel.
 *
 * Elle vit ici, et non dans un `*.fixtures.ts`, parce que trois modules doivent
 * la *reconnaître pour la refuser* : comptes, demandes et visiteurs. La refuser
 * demande de pouvoir la nommer.
 *
 * L'autorisation elle-même n'est pas ici : elle se lit sur
 * `config.autoriserComptesDemo`, à refus par défaut.
 */
export const VISITEUR_DEMO = "visiteur-demo";

/** Le téléphone porté par le compte de démonstration, pour le retrouver en base. */
export const TELEPHONE_VISITEUR_DEMO = "770000000";

/**
 * Cette valeur est-elle l'identité de démonstration, sous une forme ou une autre ?
 *
 * La comparaison est insensible à la casse et aux espaces de bord : un cookie
 * recopié à la main vaut autant qu'un cookie posé par le code, et
 * `  Visiteur-Demo  ` ne doit pas passer là où `visiteur-demo` est refusé.
 */
export function estIdentiteDemo(valeur?: string | null): boolean {
  if (!valeur || typeof valeur !== "string") return false;
  return valeur.trim().toLowerCase() === VISITEUR_DEMO;
}
