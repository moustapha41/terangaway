import type { Avis, CriteresLogement, Facettes, Logement } from "@teranga/contracts";

/**
 * Port du catalogue de logements.
 *
 * Quatre questions, pas une de plus — chacune devra devenir une requête SQL.
 *
 * `facettes` est séparée de `chercher` à dessein : les compteurs de filtres se
 * calculent sur le **périmètre** (la ville), pas sur le résultat filtré. Sinon
 * cocher « villa » ferait tomber tous les autres compteurs à zéro, et plus
 * personne ne pourrait élargir sa recherche. En SQL ce sera un `GROUP BY`
 * distinct de la requête principale.
 */
export interface DepotLogements {
  chercher(criteres: Partial<CriteresLogement>): Promise<Logement[]>;
  facettes(ville?: string): Promise<Facettes>;
  parSlug(slug: string): Promise<Logement | null>;
  parId(id: string): Promise<Logement | null>;
  /** Les avis d'un logement. Déposés après un séjour terminé, jamais avant. */
  avis(logementId: string, nombre: number): Promise<Avis[]>;
}
