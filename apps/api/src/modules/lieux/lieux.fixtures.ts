import { Injectable } from "@nestjs/common";
import { LIEUX, LOGEMENTS } from "@teranga/fixtures";

import type { DepotLieux, Lieu } from "./lieux.depot";

@Injectable()
export class DepotLieuxFixtures implements DepotLieux {
  async tous(): Promise<Lieu[]> {
    return LIEUX;
  }

  /** Les villes où il y a vraiment quelque chose à réserver. */
  async villes(): Promise<string[]> {
    return [...new Set(LOGEMENTS.map((l) => l.ville))].sort((a, b) => a.localeCompare(b, "fr"));
  }

  async quartiers(ville?: string): Promise<string[]> {
    const dans = ville
      ? LOGEMENTS.filter((l) => l.ville.toLowerCase() === ville.toLowerCase())
      : LOGEMENTS;
    return [...new Set(dans.map((l) => l.quartier))].sort((a, b) => a.localeCompare(b, "fr"));
  }
}
