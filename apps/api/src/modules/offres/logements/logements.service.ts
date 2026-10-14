import { Inject, Injectable } from "@nestjs/common";
import type { Avis, CriteresLogement, Logement, ResultatsLogements } from "@teranga/contracts";

import { DEPOT_LOGEMENTS } from "../../../commun/depots/depot";
import { introuvable } from "../../../commun/erreurs";
import type { DepotLogements } from "./logements.depot";

const PAR_PAGE = 12;

@Injectable()
export class ServiceLogements {
  constructor(@Inject(DEPOT_LOGEMENTS) private readonly depot: DepotLogements) {}

  async chercher(
    criteres: Partial<CriteresLogement>,
    page = 1,
  ): Promise<ResultatsLogements> {
    // Les deux appels sont indépendants : le résultat filtré d'un côté, les
    // compteurs de filtres calculés sur toute la ville de l'autre.
    const [trouves, facettes] = await Promise.all([
      this.depot.chercher(criteres),
      this.depot.facettes(criteres.ville),
    ]);

    const tries = trier(trouves, criteres.tri);
    const debut = (page - 1) * PAR_PAGE;

    return {
      elements: tries.slice(debut, debut + PAR_PAGE),
      total: tries.length,
      page,
      parPage: PAR_PAGE,
      facettes,
    };
  }

  async parSlug(slug: string): Promise<Logement> {
    const logement = await this.depot.parSlug(slug);
    if (!logement) throw introuvable("Logement");
    return logement;
  }

  async parId(id: string): Promise<Logement> {
    const logement = await this.depot.parId(id);
    if (!logement) throw introuvable("Logement");
    return logement;
  }

  async avis(slug: string): Promise<Avis[]> {
    const logement = await this.parSlug(slug);
    return this.depot.avis(logement.id, logement.nombreAvis ?? 0);
  }
}

/**
 * Ordre d'affichage.
 *
 * « Pertinence » n'est pas un ordre arbitraire : les mieux notés d'abord, et à
 * note égale le moins cher. C'est l'ordre que le site appliquait déjà.
 */
function trier(logements: Logement[], tri: CriteresLogement["tri"]): Logement[] {
  const copie = [...logements];
  switch (tri) {
    case "prix-croissant":
      return copie.sort((a, b) => a.prixParNuit - b.prixParNuit);
    case "prix-decroissant":
      return copie.sort((a, b) => b.prixParNuit - a.prixParNuit);
    case "capacite":
      return copie.sort((a, b) => b.capacite - a.capacite);
    case "note":
      return copie.sort((a, b) => (b.note ?? 0) - (a.note ?? 0));
    default:
      return copie.sort(
        (a, b) => (b.note ?? 0) - (a.note ?? 0) || a.prixParNuit - b.prixParNuit,
      );
  }
}
