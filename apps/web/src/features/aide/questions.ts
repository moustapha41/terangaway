/**
 * Les neuf questions du centre d'aide — maquette aide, colonne de gauche.
 *
 * L'ordre est celui de la maquette, et il suit le parcours : on crée un compte,
 * on réserve, on modifie, on paie, on contacte, puis les questions qui ne se
 * posent qu'une fois sur place.
 */
export const QUESTIONS = [
  "compte",
  "reserver",
  "annuler",
  "paiement",
  "contacter",
  "securite",
  "probleme",
  "avis",
  "devenirPrestataire",
] as const;

export type CleQuestion = (typeof QUESTIONS)[number];
