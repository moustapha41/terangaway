import { Injectable } from "@nestjs/common";
import type { Avis, CriteresLogement, Facettes, Logement } from "@teranga/contracts";
import { avisDe, LOGEMENTS } from "@teranga/fixtures";

import type { DepotLogements } from "./logements.depot";

/**
 * Catalogue de démonstration.
 *
 * Seul fichier du module autorisé à connaître `@teranga/fixtures`
 * (`pnpm -F @teranga/api verifier:depots`). Le filtrage reprend exactement
 * celui que le site appliquait déjà : la bascule vers l'API ne doit rien
 * changer à ce que le visiteur voit.
 */
@Injectable()
export class DepotLogementsFixtures implements DepotLogements {
  /** La ville borne le catalogue ; tout le reste filtre à l'intérieur. */
  private perimetre(ville?: string): Logement[] {
    if (!ville) return LOGEMENTS;
    const recherche = ville.toLowerCase();
    return LOGEMENTS.filter((l) => l.ville.toLowerCase().includes(recherche));
  }

  async chercher(criteres: Partial<CriteresLogement>): Promise<Logement[]> {
    let trouves = this.perimetre(criteres.ville);

    if (criteres.personnes) trouves = trouves.filter((l) => l.capacite >= criteres.personnes!);
    if (criteres.capaciteMin) trouves = trouves.filter((l) => l.capacite >= criteres.capaciteMin!);
    if (criteres.types?.length) trouves = trouves.filter((l) => criteres.types!.includes(l.type));
    if (criteres.quartiers?.length) {
      trouves = trouves.filter((l) => criteres.quartiers!.includes(l.quartier));
    }
    if (criteres.equipements?.length) {
      trouves = trouves.filter((l) =>
        criteres.equipements!.every((e) => l.equipements.includes(e)),
      );
    }
    if (criteres.prixMin) trouves = trouves.filter((l) => l.prixParNuit >= criteres.prixMin!);
    if (criteres.prixMax) trouves = trouves.filter((l) => l.prixParNuit <= criteres.prixMax!);

    return trouves;
  }

  async facettes(ville?: string): Promise<Facettes> {
    const logements = this.perimetre(ville);
    const compter = (valeurs: string[]) =>
      valeurs.reduce<Record<string, number>>(
        (acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }),
        {},
      );
    const prix = logements.map((l) => l.prixParNuit);

    return {
      total: logements.length,
      types: compter(logements.map((l) => l.type)),
      quartiers: compter(logements.map((l) => l.quartier)),
      equipements: compter(logements.flatMap((l) => l.equipements)),
      prix: {
        min: prix.length ? Math.min(...prix) : 0,
        max: prix.length ? Math.max(...prix) : 0,
      },
    };
  }

  async parSlug(slug: string): Promise<Logement | null> {
    return LOGEMENTS.find((l) => l.slug === slug) ?? null;
  }

  async parId(id: string): Promise<Logement | null> {
    return LOGEMENTS.find((l) => l.id === id) ?? null;
  }

  async avis(logementId: string, nombre: number): Promise<Avis[]> {
    return avisDe(logementId, nombre);
  }
}
