import type { SensEcartAcompte, VueAcompteAdmin } from "@teranga/contracts";

/**
 * Ce que l'écran de l'acompte décide, sans React : testable seul.
 *
 * L'API reste juge de tout — montant attendu, écart, concurrence, droits. Ces
 * fonctions ne font que prévenir la personne avant qu'elle envoie, et choisir
 * le texte d'un refus.
 */

/** « 186 000 FCFA » : la monnaie du paiement, quelle que soit la langue de l'écran. */
export function formaterFrancs(montant: number, langue: string): string {
  const nombre = new Intl.NumberFormat(langue).format(montant).replace(/[  ]/g, " ");
  return `${nombre} FCFA`;
}

export interface AnalyseSaisie {
  /** `null` tant que la saisie n'est pas un entier strictement positif. */
  sens: SensEcartAcompte | null;
  /** Montant saisi − reste dû ; négatif = il manquera encore. */
  ecart: number;
  /** L'écart doit être reconnu explicitement, avec un commentaire. */
  exigeConfirmation: boolean;
}

/** Compare ce que la personne tape au reste dû que le serveur a calculé. */
export function analyserSaisie(vue: VueAcompteAdmin, texte: string): AnalyseSaisie {
  const reste = vue.resteDu ?? 0;
  const propre = texte.replace(/[\s  ]/g, "");
  if (!/^\d+$/.test(propre) || Number(propre) <= 0) {
    return { sens: null, ecart: 0, exigeConfirmation: false };
  }
  const montant = Number(propre);
  const sens: SensEcartAcompte = montant === reste ? "exact" : montant < reste ? "inferieur" : "superieur";
  return { sens, ecart: montant - reste, exigeConfirmation: sens !== "exact" };
}

/** La saisie peut-elle partir ? Le serveur revérifie tout, ceci évite un aller-retour inutile. */
export function saisiePrete(
  analyse: AnalyseSaisie,
  champs: { verifie: boolean; ecartConfirme: boolean; commentaire: string },
): boolean {
  if (analyse.sens === null || !champs.verifie) return false;
  return !analyse.exigeConfirmation || (champs.ecartConfirme && champs.commentaire.trim().length > 0);
}

/**
 * La clé de texte d'un refus de l'API. Les messages du serveur sont en
 * français et citent des montants : l'écran choisit son texte sur le code.
 */
export function cleErreurAcompte(code: string): string {
  switch (code) {
    case "ACOMPTE_ECART_A_CONFIRMER":
      return "admin.acompte.erreur.ecart";
    case "ACOMPTE_CUMUL_CONCURRENT":
    case "ACOMPTE_STATUT_CONCURRENT":
      return "admin.acompte.erreur.concurrent";
    case "ACOMPTE_RECEPTION_DOUBLON":
      return "admin.acompte.erreur.doublon";
    case "ACOMPTE_NON_ATTENDU":
    case "ACOMPTE_TRANSITION_INTERDITE":
      return "admin.acompte.erreur.nonAttendu";
    case "ACOMPTE_DEMANDE_CLOSE":
      return "admin.acompte.erreur.demandeClose";
    case "ACOMPTE_RIEN_A_CONFIRMER":
      return "admin.acompte.erreur.rienAConfirmer";
    case "ACOMPTE_MOTIF_REQUIS":
    case "ACOMPTE_EXAMEN_REQUIS":
      return "admin.acompte.erreur.motifRequis";
    case "ACOMPTE_RIEN_A_REMBOURSER":
      return "admin.acompte.erreur.rienARembourser";
    case "ACOMPTE_NON_A_REMBOURSER":
      return "admin.acompte.erreur.nonARembourser";
    case "ACOMPTE_REMBOURSEMENT_MONTANT":
      return "admin.acompte.erreur.montantRemboursement";
    case "ACOMPTE_PAS_EN_RETARD":
    case "ACOMPTE_RIEN_RECU":
      return "admin.acompte.erreur.pasEnRetard";
    case "ACOMPTE_PAIEMENT_INCOMPLET":
      return "admin.acompte.erreur.incomplet";
    case "NON_AUTHENTIFIE":
    case "ACCES_INTERDIT":
    case "INTERDIT":
      return "admin.acompte.erreur.session";
    case "ACOMPTE_EVENEMENT_INVALIDE":
    case "REQUETE_INVALIDE":
      return "admin.acompte.erreur.invalide";
    default:
      return "admin.acompte.erreur.serveur";
  }
}

/** Le texte du résultat d'un envoi d'e-mail — jamais « envoyé » si ce n'est pas vrai. */
export function cleEtatEnvoi(etat: string | undefined): string | null {
  switch (etat) {
    case "envoye":
    case "envoyees":
      return "admin.acompte.envoi.envoye";
    case "echec":
      return "admin.acompte.envoi.echec";
    case "sans_destinataire":
      return "admin.acompte.envoi.sansDestinataire";
    case "non_requis":
    case "non_requises":
    case "deja_envoyees":
      return "admin.acompte.envoi.nonRequis";
    default:
      return null;
  }
}
