/**
 * La fenêtre des Jeux, en un seul endroit.
 *
 * Les modèles d'envoi aux partenaires la fixent : « périodes libres entre le
 * 20 octobre et le 20 novembre ». Les dates d'exemple de la maquette — 12 au
 * 26 janvier 2026 — sont **antérieures** à cette fenêtre : affichées telles
 * quelles, le calendrier les grise toutes, et la recherche ne peut rien trouver.
 *
 * On suit donc la fenêtre réelle, pas l'illustration de la maquette.
 */
export const FENETRE_JEUX = { debut: "2026-10-20", fin: "2026-11-20" } as const;

/** Proposition par défaut : une semaine au cœur de la quinzaine. */
export const SEJOUR_DEFAUT = { debut: "2026-10-25", fin: "2026-11-01" } as const;
