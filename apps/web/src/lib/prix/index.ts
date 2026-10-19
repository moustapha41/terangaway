import type { Logement } from "@teranga/contracts";
import type { Langue } from "@/lib/i18n/langues";

/**
 * Prix — dossier de conception §C.4.
 *
 * Trois règles, toutes obligatoires :
 *   un prix n'apparaît jamais sans son unité ;
 *   espace entre les milliers, « FCFA » après le montant, dans les trois langues ;
 *   la conversion est un texte secondaire, précédée de « environ ».
 *
 * Le franc CFA n'a pas de décimales. `Intl.NumberFormat` le sait, mais on fixe
 * quand même les deux bornes : un arrondi silencieux sur un prix serait grave.
 */
const DEVISE = "FCFA";

export function formaterMontant(montant: number, langue: Langue): string {
  return new Intl.NumberFormat(langue, {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(Math.round(montant))
    // L'espace insécable étroit évite que le montant se coupe en fin de ligne.
    .replace(/[  ,.\s]/g, " ");
}

/**
 * Le prix que le visiteur voit, et l'unité qui va avec.
 *
 * La plupart des logements se louent à la nuitée. Quelques appartements de
 * Dakar ne se louent qu'au mois : leur `prixParNuit` n'est que le loyer divisé
 * par trente, un chiffre de calcul que personne n'a annoncé. Afficher cette
 * division reviendrait à inventer un tarif — c'est le loyer qui s'affiche, et
 * l'unité change avec lui.
 */
export function prixAffiche(
  logement: Pick<Logement, "prixParNuit" | "prixParMois" | "seulementAuMois">,
  ): { montant: number; cleUnite: "commun.parNuit" | "commun.parMois" } {
  return logement.seulementAuMois && logement.prixParMois !== undefined
    ? { montant: logement.prixParMois, cleUnite: "commun.parMois" }
    : { montant: logement.prixParNuit, cleUnite: "commun.parNuit" };
}

/** « 75 000 FCFA ». Jamais le montant seul. */
export function formaterPrix(montant: number, langue: Langue): string {
  return `${formaterMontant(montant, langue)} ${DEVISE}`;
}

/**
 * « environ 114 € ». Texte secondaire seulement : le prix qui engage reste en FCFA,
 * puisque le paiement se fait sur place et en espèces.
 */
export function formaterConversion(
  montant: number,
  taux: number,
  devise: "EUR" | "USD",
  langue: Langue,
): string {
  const converti = new Intl.NumberFormat(langue, {
    style: "currency",
    currency: devise,
    maximumFractionDigits: 0,
  }).format(montant * taux);
  return converti;
}
