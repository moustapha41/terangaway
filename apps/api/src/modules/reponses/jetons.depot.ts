import type { MotifRefus } from "@teranga/contracts";

export type EtatJeton = "valide" | "repondu" | "expire";

export interface Jeton {
  jeton: string;
  demandeId: string;
  etat: EtatJeton;
  reponse?: "acceptee" | "refusee" | "indisponible";
  expireLe: string;
}

export interface DepotJetons {
  parValeur(jeton: string): Promise<Jeton | null>;
  marquerRepondu(
    jeton: string,
    reponse: NonNullable<Jeton["reponse"]>,
    motif?: MotifRefus,
  ): Promise<Jeton>;
}
