import { Inject, Injectable } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import type { Demande, MotifRefus } from "@teranga/contracts";

import { DEPOT_JETONS } from "../../commun/depots/depot";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { ServiceDemandes } from "../demandes/demandes.service";
import type { DepotJetons, EtatJeton, Jeton } from "./jetons.depot";

export interface DemandePourPartenaire {
  reference: string;
  // Repris du contrat plutôt que recopié : un genre ajouté à `Demande`
  // n'oblige plus à venir corriger ici (V2 a ajouté « service »).
  genre: Demande["offre"]["genre"];
  titre: string;
  dates: { debut: string; fin: string };
  personnes: number;
  heureArrivee?: string;
  total: number;
  expireLe: string;
}

export interface VueJeton {
  etat: EtatJeton;
  reponse?: Jeton["reponse"];
  demande?: DemandePourPartenaire;
}

@Injectable()
export class ServiceReponses {
  constructor(
    @Inject(DEPOT_JETONS) private readonly jetons: DepotJetons,
    private readonly demandes: ServiceDemandes,
  ) {}

  async ouvrir(valeur: string): Promise<VueJeton> {
    const jeton = await this.jetons.parValeur(valeur);
    if (!jeton) throw introuvable("Jeton");

    const perime = new Date(jeton.expireLe).getTime() < Date.now();
    const etat: EtatJeton =
      jeton.etat === "valide" && perime ? "expire" : jeton.etat;

    if (etat !== "valide") {
      return { etat, reponse: jeton.reponse };
    }

    const demande = await this.demandes.obtenir(jeton.demandeId);
    return {
      etat,
      demande: {
        reference: demande.reference,
        genre: demande.offre.genre,
        titre: demande.offre.titre,
        dates: demande.dates,
        personnes: demande.personnes,
        heureArrivee: demande.heureArrivee,
        total: demande.prix.total,
        expireLe: jeton.expireLe,
      },
    };
  }

  async repondre(
    valeur: string,
    reponse: NonNullable<Jeton["reponse"]>,
    motif?: MotifRefus,
  ): Promise<VueJeton> {
    const jeton = await this.jetons.parValeur(valeur);
    if (!jeton) throw introuvable("Jeton");

    const perime = new Date(jeton.expireLe).getTime() < Date.now();
    if (jeton.etat !== "valide" || perime) {
      throw new ErreurMetier(
        "JETON_INVALIDE",
        "Ce lien n'est plus valable.",
        HttpStatus.GONE,
      );
    }

    await this.jetons.marquerRepondu(valeur, reponse, motif);

    if (reponse === "acceptee") {
      await this.demandes.accepterParPartenaire(jeton.demandeId);
    } else {
      const motifRefus: MotifRefus =
        reponse === "indisponible" ? "plus-disponible" : (motif ?? "autre");
      await this.demandes.refuserParPartenaire(jeton.demandeId, motifRefus);
    }

    return { etat: "repondu", reponse };
  }
}
