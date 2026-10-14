import { Injectable } from "@nestjs/common";
import type { MotifRefus } from "@teranga/contracts";
import { JETONS } from "@teranga/fixtures";

import { introuvable } from "../../commun/erreurs";
import type { DepotJetons, Jeton } from "./jetons.depot";

@Injectable()
export class DepotJetonsFixtures implements DepotJetons {
  private readonly jetons: Jeton[] = structuredClone(JETONS);

  async parValeur(valeur: string): Promise<Jeton | null> {
    return this.jetons.find((j) => j.jeton === valeur) ?? null;
  }

  async marquerRepondu(
    valeur: string,
    reponse: NonNullable<Jeton["reponse"]>,
    _motif?: MotifRefus,
  ): Promise<Jeton> {
    const index = this.jetons.findIndex((j) => j.jeton === valeur);
    if (index < 0) throw introuvable("Jeton");
    this.jetons[index] = {
      ...this.jetons[index],
      etat: "repondu",
      reponse,
    };
    return structuredClone(this.jetons[index]);
  }
}
