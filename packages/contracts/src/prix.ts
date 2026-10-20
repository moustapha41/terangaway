import type { Logement } from "./types/logement";

/** Une semaine de séjour, telle que la plateforme la compte. */
export const NUITS_PAR_SEMAINE = 7;

/**
 * Le prix d'une semaine : celui que le propriétaire annonce, ou sept nuitées.
 *
 * Plusieurs annonces portent un barème dégressif — une semaine y coûte moins
 * que sept fois la nuitée. Le prix affiché par la plateforme est celui de la
 * semaine (§C.4) : multiplier par sept dans le dos du propriétaire afficherait
 * un tarif qu'il n'a pas demandé.
 */
export function prixSemaine(
  logement: Pick<Logement, "prixParNuit" | "prixParSemaine">,
): number {
  return logement.prixParSemaine ?? logement.prixParNuit * NUITS_PAR_SEMAINE;
}

/**
 * L'hébergement d'un séjour, hors frais fixes.
 *
 * Chaque semaine entière est comptée au tarif de la semaine, les nuits qui
 * restent à la nuitée. Pour une annonce sans tarif semaine, la règle se réduit
 * exactement à l'ancienne — nuitée multipliée par le nombre de nuits.
 *
 * Cette fonction vit dans les contrats parce que le site et l'API doivent
 * compter pareil : un total annoncé sur une fiche et un total enregistré en
 * base qui divergeraient de quelques dizaines de milliers de francs, c'est un
 * litige avec le visiteur, pas un écart d'affichage.
 */
export function sousTotalSejour(
  logement: Pick<Logement, "prixParNuit" | "prixParSemaine">,
  nuits: number,
): number {
  const semaines = Math.floor(nuits / NUITS_PAR_SEMAINE);
  const reste = nuits % NUITS_PAR_SEMAINE;
  return semaines * prixSemaine(logement) + reste * logement.prixParNuit;
}

/** Le total d'un séjour : l'hébergement et les frais annoncés avec lui. */
export function totalSejour(
  logement: Pick<Logement, "prixParNuit" | "prixParSemaine">,
  nuits: number,
  fraisFixes: readonly { montant: number }[] = [],
): number {
  return sousTotalSejour(logement, nuits) + fraisFixes.reduce((s, f) => s + f.montant, 0);
}
