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

/**
 * ÉCARTS CONNUS entre cette table et ce que le code applique.
 *
 * Aucun n'est corrigé ici : chacun suppose une règle qui n'est pas tranchée, et
 * `delais-ecarts.test.ts` fige l'état actuel pour qu'un changement soit
 * toujours un choix, jamais un effet de bord.
 *
 *  1. **Taxi, confirmation visiteur.** Déclarée 15 min (PRD §10), appliquée 3 h :
 *     `transitionner` donne le délai du trajet à tout véhicule autre qu'une
 *     location. Appliquer 15 min est la règle écrite, mais le visiteur n'est
 *     prévenu d'aucune façon à l'acceptation (aucun e-mail, aucun compte à
 *     rebours à l'écran) : presque toute demande de taxi expirerait avant qu'il
 *     ne la voie.
 *  2. **Service, confirmation visiteur.** Déclarée 12 h ici (« proches du
 *     logement », absente du PRD), appliquée 3 h pour la même raison.
 *  3. **Service, expiration de la réponse.** Déclarée 6 h ici, mais une demande
 *     de service est créée sans échéance : elle n'expire jamais.
 *  4. **Logement, expiration de la réponse.** 2 h ici (« aligné sur le mock »),
 *     6 h dans le README du module (PRD §10).
 *  5. **Trajet, expiration.** « 3 h, ou 1 h avant la prise en charge » dans le
 *     PRD ; seule la première moitié est appliquée.
 *  6. **Jeton du partenaire.** Sa validité est fixée à 2 h pour tous les genres
 *     (`emettreJetonReponse`), quel que soit `expirationReponseMinutes` : plus
 *     court que la fenêtre d'une location (6 h) ou d'un trajet (3 h), plus long
 *     que celle d'un taxi (30 min).
 *  7. **Fenêtre nocturne (22 h – 7 h).** Décrite dans le PRD, non appliquée.
 */
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
