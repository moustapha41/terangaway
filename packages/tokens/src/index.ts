/* Généré par scripts/generer.mjs depuis tokens.json. Ne pas modifier à la main. */

import tokens from "./tokens.json" with { type: "json" };

export { tokens };

export const STATUTS = {
  envoyee: { icone: "horloge", couleur: "alerte", libelle: "En attente de réponse" },
  acceptee: { icone: "coche-cercle", couleur: "succes", libelle: "Acceptée : à confirmer" },
  confirmee: { icone: "double-coche", couleur: "succes", libelle: "Confirmée" },
  terminee: { icone: "drapeau", couleur: "encre-douce", libelle: "Terminée" },
  refusee: { icone: "croix", couleur: "danger", libelle: "Refusée" },
  expiree: { icone: "tiret", couleur: "encre-douce", libelle: "Expirée" },
  annulee: { icone: "croix-cercle", couleur: "encre-douce", libelle: "Annulée" },
} as const;

export type Statut = keyof typeof STATUTS;

/** Ordre d'avancement d'une demande ; les statuts terminaux ne sont pas dans la frise. */
export const FRISE: readonly Statut[] = ["envoyee", "acceptee", "confirmee", "terminee"];
export const STATUTS_TERMINAUX: readonly Statut[] = ["terminee", "refusee", "expiree", "annulee"];
