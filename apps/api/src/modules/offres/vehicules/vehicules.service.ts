import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { OffreTransport, Vehicule } from "@teranga/contracts";

import { DEPOT_VEHICULES } from "../../../commun/depots/depot";
import { ErreurMetier, introuvable } from "../../../commun/erreurs";
import { config } from "../../../config/configuration";
import type { CriteresVehicules, DepotVehicules, FacettesVehicules } from "./vehicules.depot";

export type BesoinTransport = "trajet" | "location" | "taxi";

/** L'offre que chaque besoin exige du véhicule. */
const OFFRE_POUR: Record<BesoinTransport, OffreTransport | undefined> = {
  trajet: "trajet-avec-chauffeur",
  location: "location-avec-chauffeur",
  // Le taxi ne se choisit pas dans le parc : il s'estime. Aucun filtre d'offre.
  taxi: undefined,
};

function prixDe(v: Vehicule): number {
  return v.prixParTrajet ?? v.prixParJour ?? 0;
}

@Injectable()
export class ServiceVehicules {
  constructor(@Inject(DEPOT_VEHICULES) private readonly depot: DepotVehicules) {}

  async chercher(
    besoin: BesoinTransport,
    criteres: Omit<CriteresVehicules, "offre"> & { quand?: string },
  ): Promise<Vehicule[]> {
    // « Une prise en charge demandée à moins de deux heures est refusée » (§B.3).
    // La règle vit ici, pas dans l'écran : un appel direct à l'API doit la subir
    // aussi.
    if (besoin === "trajet" && criteres.quand && !this.delaiSuffisant(criteres.quand)) {
      throw new ErreurMetier(
        "DELAI_TROP_COURT",
        `La prise en charge doit être demandée au moins ${config.delaiMinimumHeures} heures à l'avance.`,
        HttpStatus.CONFLICT,
      );
    }

    const trouves = await this.depot.chercher({
      ...criteres,
      offre: OFFRE_POUR[besoin],
    });

    // Le moins cher d'abord : c'est l'ordre que le site appliquait déjà.
    return [...trouves].sort((a, b) => prixDe(a) - prixDe(b));
  }

  /**
   * Compteurs de filtres pour l'écran de résultats.
   *
   * Séparés de la recherche, comme pour les logements : ils portent sur le
   * périmètre du besoin, pas sur ce qui reste après filtrage.
   */
  async facettes(
    besoin: BesoinTransport,
    criteres: Omit<CriteresVehicules, "offre">,
  ): Promise<FacettesVehicules> {
    return this.depot.facettes({ ...criteres, offre: OFFRE_POUR[besoin] });
  }

  async parSlug(slug: string): Promise<Vehicule> {
    const vehicule = await this.depot.parSlug(slug);
    if (!vehicule) throw introuvable("Vehicule");
    return vehicule;
  }

  async parId(id: string): Promise<Vehicule> {
    const vehicule = await this.depot.parId(id);
    if (!vehicule) throw introuvable("Vehicule");
    return vehicule;
  }

  /**
   * Fourchette indicative pour une course de taxi.
   *
   * Ce n'est pas un prix : un taxi se négocie sur place. On annonce une
   * fourchette pour que le visiteur sache à quoi s'attendre, et le site
   * l'affiche comme telle.
   */
  async estimerTaxi(passagers: number): Promise<{ bas: number; haut: number }> {
    const base = passagers > 4 ? 8000 : 5000;
    return { bas: base, haut: Math.round(base * 1.6) };
  }

  private delaiSuffisant(quand: string, maintenant = new Date()): boolean {
    const ecart = new Date(quand).getTime() - maintenant.getTime();
    return ecart >= config.delaiMinimumHeures * 60 * 60 * 1000;
  }
}
