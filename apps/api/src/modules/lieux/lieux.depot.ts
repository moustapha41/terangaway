export interface Lieu {
  valeur: string;
  detail: string;
}

/**
 * Port des lieux proposés à la saisie.
 *
 * Ce sont des points de repère publics — un aéroport, un stade, un quartier —
 * jamais une adresse de partenaire. Les coordonnées exactes n'apparaissent
 * qu'après confirmation (§D.4) et ne passent pas par ici.
 */
export interface DepotLieux {
  tous(): Promise<Lieu[]>;
  villes(): Promise<string[]>;
  quartiers(ville?: string): Promise<string[]>;
}
