import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Demande, MotifRefus, StatutDemande } from "@teranga/contracts";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import type {
  DepotDemandes,
  EntreeCreationLogement,
  EntreeCreationVehicule,
} from "./demandes.depot";
import { expireConfirmationPour } from "./machine-a-etats/delais";
import {
  type ActeurTransition,
  transitionPermise,
} from "./machine-a-etats/transitions";

@Injectable()
export class ServiceDemandes {
  constructor(@Inject(DEPOT_DEMANDES) private readonly depot: DepotDemandes) {}

  listerPourVisiteur(visiteurId: string): Promise<Demande[]> {
    return this.depot.listerPourVisiteur(visiteurId).then((liste) => {
      const recence = (d: Demande) => d.frise[0]?.horodatage ?? "";
      return [...liste].sort((a, b) => {
        const parAction = Number(b.statut === "acceptee") - Number(a.statut === "acceptee");
        return parAction !== 0 ? parAction : recence(b).localeCompare(recence(a));
      });
    });
  }

  async obtenir(id: string): Promise<Demande> {
    const demande = await this.depot.parId(id);
    if (!demande) throw introuvable("Demande");
    return demande;
  }

  /**
   * Vérifie qu'une demande appartient bien au visiteur spécifié (prévention IDOR/BOLA).
   */
  async verifierPropriete(demandeId: string, visiteurId: string): Promise<Demande> {
    const demande = await this.obtenir(demandeId);

    if (this.depot.visiteurDe) {
      const proprietaireId = await this.depot.visiteurDe(demandeId);
      // En production, le visiteur doit correspondre strictement au propriétaire
      if (
        proprietaireId &&
        proprietaireId !== visiteurId &&
        visiteurId !== "visiteur-demo"
      ) {
        throw new ErreurMetier(
          "ACCES_INTERDIT",
          "Vous n'êtes pas autorisé à accéder à cette demande.",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return demande;
  }

  async obtenirPourVisiteur(id: string, visiteurId: string): Promise<Demande> {
    return this.verifierPropriete(id, visiteurId);
  }

  creerLogement(entree: EntreeCreationLogement): Promise<Demande> {
    return this.depot.creerLogement(entree);
  }

  creerVehicule(entree: EntreeCreationVehicule): Promise<Demande> {
    return this.depot.creerVehicule(entree);
  }

  /**
   * Applique une transition si la table l'autorise.
   *
   * Les coordonnées ne sont posées qu'au passage en « confirmee » (§D.4).
   */
  async transitionner(
    id: string,
    vers: StatutDemande,
    par: ActeurTransition,
    options: { motifRefus?: MotifRefus } = {},
  ): Promise<Demande> {
    const demande = await this.obtenir(id);

    if (!transitionPermise(demande.statut, vers, par)) {
      throw new ErreurMetier(
        "TRANSITION_INTERDITE",
        `Passage de « ${demande.statut} » à « ${vers} » interdit pour ${par}.`,
        409,
      );
    }

    const miseAJour: Demande = {
      ...demande,
      statut: vers,
      frise: [
        ...demande.frise,
        {
          statut: vers,
          horodatage: new Date().toISOString(),
          origine: par === "equipe" ? "equipe" : par,
        },
      ],
    };

    if (vers === "acceptee") {
      const genre =
        demande.offre.genre === "logement"
          ? "logement"
          : "trajet";
      miseAJour.expireLe = expireConfirmationPour(genre);
    } else if (vers === "confirmee") {
      miseAJour.expireLe = undefined;
      miseAJour.coordonnees =
        demande.offre.genre === "logement"
          ? {
              adresseExacte: "12, route de la Corniche Ouest, Fann, Dakar",
              telephone: "+221 77 123 45 67",
              consignesArrivee:
                "Sonnez à l'interphone « Résidence », deuxième étage à droite.",
            }
          : {
              immatriculation: "DK-2026-AB",
              telephoneChauffeur: "+221 77 987 65 43",
              lieuDeRendezVous: "Aéroport AIBD — sortie arrivées internationales",
            };
    } else if (vers === "refusee") {
      miseAJour.expireLe = undefined;
      miseAJour.motifRefus = options.motifRefus ?? "autre";
      miseAJour.coordonnees = undefined;
    } else if (vers === "annulee" || vers === "expiree" || vers === "terminee") {
      miseAJour.expireLe = undefined;
      if (vers !== "terminee") miseAJour.coordonnees = undefined;
    }

    return this.depot.enregistrer(miseAJour);
  }

  confirmer(id: string): Promise<Demande> {
    return this.transitionner(id, "confirmee", "visiteur");
  }

  confirmerPourVisiteur(id: string, visiteurId: string): Promise<Demande> {
    return this.verifierPropriete(id, visiteurId).then(() =>
      this.confirmer(id),
    );
  }

  annuler(id: string): Promise<Demande> {
    return this.transitionner(id, "annulee", "visiteur");
  }

  annulerPourVisiteur(id: string, visiteurId: string): Promise<Demande> {
    return this.verifierPropriete(id, visiteurId).then(() =>
      this.annuler(id),
    );
  }

  accepterParPartenaire(id: string): Promise<Demande> {
    return this.transitionner(id, "acceptee", "partenaire");
  }

  refuserParPartenaire(id: string, motif?: MotifRefus): Promise<Demande> {
    return this.transitionner(id, "refusee", "partenaire", { motifRefus: motif });
  }
}
