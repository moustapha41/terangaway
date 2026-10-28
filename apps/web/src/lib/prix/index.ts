import { prixSemaine, type Logement } from "@teranga/contracts";
import type { Langue } from "@/lib/i18n/langues";

/**
 * Prix — dossier de conception §C.4.
 *
 * Trois règles, toutes obligatoires :
 *   un prix n'apparaît jamais sans son unité ;
 *   espace entre les milliers, « FCFA » après le montant, dans les trois langues ;
 *   la conversion (euro, dollar) est un texte secondaire, précédée de « environ ».
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
 * La règle de prix d'un séjour vit dans les contrats : le site et l'API
 * doivent compter pareil. Elle est relayée ici pour que l'application garde un
 * seul point d'entrée sur les prix.
 */
export {
  NUITS_PAR_MOIS,
  NUITS_PAR_SEMAINE,
  prixSemaine,
  sousTotalSejour,
  totalSejour,
} from "@teranga/contracts";

/**
 * Le prix que le visiteur voit, et l'unité qui va avec.
 *
 * Il s'annonce à la semaine : personne ne vient aux Jeux pour une nuit, et un
 * séjour se compare d'une annonce à l'autre sur sa semaine. La nuitée reste la
 * donnée du catalogue et la base des totaux — c'est l'affichage qui compte en
 * semaines, pas le calcul.
 *
 * Quelques appartements de Dakar ne se louent qu'au mois : leur `prixParNuit`
 * n'est que le loyer divisé par trente, un chiffre de calcul que personne n'a
 * annoncé. Afficher cette division reviendrait à inventer un tarif — c'est le
 * loyer qui s'affiche, et l'unité change avec lui.
 */
export function prixAffiche(
  logement: Pick<Logement, "prixParNuit" | "prixParSemaine" | "prixParMois" | "seulementAuMois">,
  ): { montant: number; cleUnite: "commun.parSemaine" | "commun.parMois" } {
  return logement.seulementAuMois && logement.prixParMois !== undefined
    ? { montant: logement.prixParMois, cleUnite: "commun.parMois" }
    : { montant: prixSemaine(logement), cleUnite: "commun.parSemaine" };
}

/** « 75 000 FCFA ». Jamais le montant seul. */
export function formaterPrix(montant: number, langue: Langue): string {
  return `${formaterMontant(montant, langue)} ${DEVISE}`;
}

/**
 * Le change, pour les écrans du visiteur.
 *
 * L'euro ne bouge pas : le franc CFA lui est rattaché par une parité fixe,
 * 1 € = 655,957 F, inchangée depuis 1999. Le dollar, lui, flotte — ce taux-là
 * est une photographie d'octobre 2026 et il dérivera. Le jour où une source de
 * taux arrive, c'est cette constante qu'elle remplace.
 */
const TAUX: Record<Devise, number> = { EUR: 655.957, USD: 610 };

export type Devise = "EUR" | "USD";

/**
 * La monnaie dans laquelle un visiteur lit les prix, d'après sa langue.
 *
 * L'Espagne est dans la zone euro : l'espagnol et le français partagent donc
 * la même monnaie, ce n'est pas un oubli.
 */
export function deviseDeLangue(langue: Langue): Devise {
  return langue === "en" ? "USD" : "EUR";
}

/** Un montant en francs, converti dans la monnaie de la langue. */
export function convertir(montantEnFrancs: number, langue: Langue): number {
  return Math.round(montantEnFrancs / TAUX[deviseDeLangue(langue)]);
}

/**
 * Le prix tel que le visiteur le lit : « 75 000 FCFA ».
 *
 * Le franc CFA est la monnaie de la donnée, du paiement **et de l'affichage** :
 * la plupart des visiteurs sont déjà au Sénégal et comptent en francs. Celui qui
 * préfère l'euro ou le dollar le demande, d'un bouton sous le prix, et la
 * conversion s'affiche alors en texte secondaire (`ConversionPrix`).
 */
export function formaterPrixVisiteur(montantEnFrancs: number, langue: Langue): string {
  return formaterPrix(montantEnFrancs, langue);
}

/** Le même montant sans sa monnaie, pour les écrans qui la nomment ailleurs. */
export function formaterMontantVisiteur(montantEnFrancs: number, langue: Langue): string {
  return formaterMontant(montantEnFrancs, langue);
}

/**
 * La conversion, quand le visiteur l'a demandée : « 1 601 € », « $1,721 ».
 *
 * Arrondie à l'unité : le franc CFA n'a pas de centimes, et un prix d'annonce
 * qui en afficherait serait une fausse précision.
 */
export function formaterPrixConverti(montantEnFrancs: number, langue: Langue): string {
  return new Intl.NumberFormat(langue, {
    style: "currency",
    currency: deviseDeLangue(langue),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertir(montantEnFrancs, langue));
}
