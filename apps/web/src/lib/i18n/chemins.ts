import { LANGUES, type Langue } from "./langues";

/**
 * Préfixe un chemin interne par la langue courante.
 *
 * « Le visiteur qui change de langue en cours de route : l'écran se recharge dans
 * la nouvelle langue sans perdre la saisie » (§B.8). Préfixer plutôt que stocker
 * la langue ailleurs rend chaque URL partageable telle quelle.
 *
 * Les URL externes passent inchangées, et une redirection ne se construit jamais
 * depuis une saisie libre (cahier des charges §11).
 */
export function avecLangue(langue: Langue, chemin: string): string {
  if (!chemin.startsWith("/")) return chemin;
  const nu = retirerLangue(chemin);
  return nu === "/" ? `/${langue}` : `/${langue}${nu}`;
}

/** Retire le préfixe de langue d'un chemin, s'il en a un. */
export function retirerLangue(chemin: string): string {
  for (const langue of LANGUES) {
    if (chemin === `/${langue}`) return "/";
    if (chemin.startsWith(`/${langue}/`)) return chemin.slice(langue.length + 1);
  }
  return chemin;
}
