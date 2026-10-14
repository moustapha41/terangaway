import type { OffreTransport, Vehicule } from "@teranga/contracts";

export interface CriteresVehicules {
  /** L'offre que le véhicule doit proposer. */
  offre?: OffreTransport;
  passagers?: number;
  bagages?: number;
  categories?: string[];
  prixMin?: number;
  prixMax?: number;
  /** Une zone desservie, telle qu'elle est écrite dans l'offre. */
  zone?: string;
}

/**
 * Compteurs de filtres.
 *
 * Comme pour les logements, chaque compteur neutralise **son propre** filtre :
 * cocher « SUV » ne doit pas faire tomber les autres catégories à zéro, sinon
 * plus personne ne peut élargir sa recherche.
 */
export interface FacettesVehicules {
  total: number;
  service: Record<string, number>;
  categorie: Record<string, number>;
  places: Record<string, number>;
  prix: { min: number; max: number };
}

/** Port du parc de véhicules. Même esprit que celui des logements. */
export interface DepotVehicules {
  chercher(criteres: CriteresVehicules): Promise<Vehicule[]>;
  facettes(criteres: CriteresVehicules): Promise<FacettesVehicules>;
  parSlug(slug: string): Promise<Vehicule | null>;
  parId(id: string): Promise<Vehicule | null>;
}
