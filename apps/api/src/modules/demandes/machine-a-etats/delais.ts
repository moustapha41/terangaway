/**
 * Délais de réponse et de confirmation (PRD §10, README du module).
 *
 * Expressés en minutes. La fenêtre nocturne (22 h – 7 h) suspend logement et
 * location : elle sera appliquée par la tâche planifiée, pas ici.
 */
export type GenreService = "logement" | "trajet" | "location" | "taxi" | "service";

export interface DelaisService {
  /** Relance support si pas de réponse. */
  relanceMinutes: number;
  /** Expiration de « envoyée » sans réponse partenaire. */
  expirationReponseMinutes: number;
  /** Délai laissé au visiteur pour confirmer après acceptation. */
  confirmationVisiteurMinutes: number;
}

export const DELAIS: Record<GenreService, DelaisService> = {
  logement: {
    relanceMinutes: 60,
    expirationReponseMinutes: 120, // 2 h — aligné sur le mock actuel
    confirmationVisiteurMinutes: 12 * 60,
  },
  trajet: {
    relanceMinutes: 30,
    expirationReponseMinutes: 3 * 60,
    confirmationVisiteurMinutes: 3 * 60,
  },
  location: {
    relanceMinutes: 60,
    expirationReponseMinutes: 6 * 60,
    confirmationVisiteurMinutes: 12 * 60,
  },
  taxi: {
    relanceMinutes: 10,
    expirationReponseMinutes: 30,
    confirmationVisiteurMinutes: 15,
  },
  /** À la demande : l'équipe traite, délais proches du logement. */
  service: {
    relanceMinutes: 60,
    expirationReponseMinutes: 6 * 60,
    confirmationVisiteurMinutes: 12 * 60,
  },
};

export function expireLePour(
  genre: GenreService,
  depuis: Date = new Date(),
): string {
  const minutes = DELAIS[genre].expirationReponseMinutes;
  return new Date(depuis.getTime() + minutes * 60_000).toISOString();
}

export function expireConfirmationPour(
  genre: GenreService,
  depuis: Date = new Date(),
): string {
  const minutes = DELAIS[genre].confirmationVisiteurMinutes;
  return new Date(depuis.getTime() + minutes * 60_000).toISOString();
}
