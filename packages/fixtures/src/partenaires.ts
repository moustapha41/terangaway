import type { Partenaire } from "@teranga/contracts";

/**
 * Partenaires de démonstration.
 *
 * Prénom et initiale seulement : le nom complet et les coordonnées ne sont
 * révélés qu'après confirmation. `verifiePar` est le nom du valideur — la fiche
 * ne porte que « vérifié le… par… », jamais la pièce justificative elle-même,
 * qui reste hors plateforme.
 */
export const PARTENAIRES: Record<string, Partenaire> = {
  // Le catalogue des logements vient d'annonces collectées par l'équipe : tant
  // que chaque propriétaire n'a pas de compte, c'est la plateforme qui répond
  // de la fiche. Un nom de personne inventé le ferait croire à tort.
  terangaWay: { id: "p-000", nomAffiche: "Teranga Way", verifieLe: "2026-10-13", verifiePar: "Équipe Teranga", membreDepuis: 2026, professionnel: true },
  aminata: { id: "p-001", nomAffiche: "Aminata D.", verifieLe: "2026-09-28", verifiePar: "Équipe Teranga", membreDepuis: 2023, professionnel: true },
  moussa: { id: "p-002", nomAffiche: "Moussa F.", verifieLe: "2026-10-02", verifiePar: "Équipe Teranga", membreDepuis: 2023, professionnel: true },
  fatou: { id: "p-003", nomAffiche: "Fatou S.", verifieLe: "2026-10-05", verifiePar: "Équipe Teranga", membreDepuis: 2024, professionnel: false },
  ibrahima: { id: "p-004", nomAffiche: "Ibrahima N.", verifieLe: "2026-09-30", verifiePar: "Équipe Teranga", membreDepuis: 2022, professionnel: true },
};
