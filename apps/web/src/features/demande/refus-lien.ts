/**
 * Les seuls refus du lien d'accès que la page sait expliquer ; tout le reste
 * devient « invalide ».
 *
 * Hors d'un fichier d'actions : une action serveur ne peut exporter que des
 * fonctions asynchrones, et la page comme l'action ont besoin de cette liste.
 */
export const REFUS_LIEN = [
  "LIEN_EXPIRE",
  "LIEN_DEJA_UTILISE",
  "LIEN_INVALIDE",
  "TROP_DE_TENTATIVES",
] as const;
export type RefusLien = (typeof REFUS_LIEN)[number];
