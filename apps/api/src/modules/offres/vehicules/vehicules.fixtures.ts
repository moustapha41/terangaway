import { Injectable } from "@nestjs/common";
import type { Vehicule } from "@teranga/contracts";
import { VEHICULES } from "@teranga/fixtures";

import { CATEGORIES_VEHICULE, OFFRES_TRANSPORT } from "@teranga/contracts";

import type { CriteresVehicules, DepotVehicules, FacettesVehicules } from "./vehicules.depot";

/** Les tranches de places proposées au filtre. */
const PLAGES: Record<string, [number, number]> = {
  "1-3": [1, 3],
  "4-6": [4, 6],
  "7+": [7, 99],
};

/** Prix de référence d'un véhicule : au trajet s'il existe, sinon à la journée. */
function prixDe(v: Vehicule): number {
  return v.prixParTrajet ?? v.prixParJour ?? 0;
}

@Injectable()
export class DepotVehiculesFixtures implements DepotVehicules {
  async chercher(criteres: CriteresVehicules): Promise<Vehicule[]> {
    return VEHICULES.filter((v) => {
      if (criteres.offre && !v.offresProposees.includes(criteres.offre)) return false;
      // « Véhicules de capacité suffisante » : on ne propose jamais trop petit.
      if (v.placesPassagers < (criteres.passagers ?? 1)) return false;
      if (v.bagages < (criteres.bagages ?? 0)) return false;
      if (criteres.categories?.length && !criteres.categories.includes(v.categorie)) return false;
      if (criteres.zone && !v.zonesCouvertes.includes(criteres.zone)) return false;
      const prix = prixDe(v);
      if (criteres.prixMin && prix < criteres.prixMin) return false;
      if (criteres.prixMax && prix > criteres.prixMax) return false;
      return true;
    });
  }

  async facettes(criteres: CriteresVehicules): Promise<FacettesVehicules> {
    // Chaque famille de compteurs se calcule en retirant son propre filtre.
    const sans = async (champ: keyof CriteresVehicules) =>
      this.chercher({ ...criteres, [champ]: undefined });

    const [pourService, pourCategorie, pourPlaces, retenus] = await Promise.all([
      sans("offre"),
      sans("categories"),
      sans("passagers"),
      this.chercher(criteres),
    ]);

    const compter = <T extends string>(liste: Vehicule[], valeurs: readonly T[], test: (v: Vehicule, x: T) => boolean) =>
      Object.fromEntries(valeurs.map((x) => [x, liste.filter((v) => test(v, x)).length]));

    const prix = retenus.map(prixDe);

    return {
      total: retenus.length,
      service: compter(pourService, OFFRES_TRANSPORT, (v, o) => v.offresProposees.includes(o)),
      categorie: compter(pourCategorie, CATEGORIES_VEHICULE, (v, c) => v.categorie === c),
      places: compter(pourPlaces, Object.keys(PLAGES) as string[], (v, p) => {
        const [a, b] = PLAGES[p];
        return v.placesPassagers >= a && v.placesPassagers <= b;
      }),
      prix: { min: prix.length ? Math.min(...prix) : 0, max: prix.length ? Math.max(...prix) : 0 },
    };
  }

  async parSlug(slug: string): Promise<Vehicule | null> {
    return VEHICULES.find((v) => v.slug === slug) ?? null;
  }

  async parId(id: string): Promise<Vehicule | null> {
    return VEHICULES.find((v) => v.id === id) ?? null;
  }
}
