import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { Demande, MotifRefus, StatutDemande } from "@teranga/contracts";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { estIdentiteDemo } from "../../commun/securite/identites-demo";
import { config } from "../../config/configuration";
import { ServiceAcomptes } from "../acomptes/acomptes.service";
import type {
  DepotDemandes,
  EntreeCreationLogement,
  EntreeCreationService,
  EntreeCreationVehicule,
  JetonReponse,
} from "./demandes.depot";
import { expireConfirmationPour } from "./machine-a-etats/delais";
import {
  type ActeurTransition,
  transitionPermise,
} from "./machine-a-etats/transitions";

@Injectable()
export class ServiceDemandes {
  private readonly logger = new Logger(ServiceDemandes.name);

  constructor(
    @Inject(DEPOT_DEMANDES) private readonly depot: DepotDemandes,
    /**
     * Facultatif : les tests et les dépôts en mémoire s'en passent. Sans lui,
     * une acceptation reste une acceptation — simplement sans acompte.
     */
    @Optional() private readonly acomptes?: ServiceAcomptes,
  ) {}

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
      // Le visiteur doit correspondre strictement au propriétaire.
      //
      // L'exception `visiteur-demo` ouvrait la lecture de *toutes* les demandes
      // à quiconque résolvait vers cette identité. Elle reste utile pour
      // parcourir les fixtures en développement, mais elle est désormais
      // adossée au verrou à refus par défaut.
      const passeDroitDemo = config.autoriserComptesDemo && estIdentiteDemo(visiteurId);
      if (proprietaireId && proprietaireId !== visiteurId && !passeDroitDemo) {
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

  creerService(entree: EntreeCreationService): Promise<Demande> {
    return this.depot.creerService(entree);
  }

  /**
   * Le jeton par lequel on répond à une demande sans se connecter.
   *
   * `null` quand la demande n'a pas de prestataire, ou quand le dépôt ne sait
   * pas en émettre — le dépôt en mémoire, par exemple. L'appelant doit savoir
   * s'en passer : un e-mail sans lien reste un e-mail qui prévient.
   */
  emettreJetonReponse(demandeId: string): Promise<JetonReponse | null> {
    return this.depot.emettreJetonReponse?.(demandeId) ?? Promise.resolve(null);
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

    const horodatage = new Date();
    const miseAJour: Demande = {
      ...demande,
      statut: vers,
      frise: [
        ...demande.frise,
        {
          statut: vers,
          horodatage: horodatage.toISOString(),
          origine: par === "equipe" ? "equipe" : par,
        },
      ],
    };

    if (vers === "acceptee") {
      // Depuis l'instant d'acceptation inscrit dans la frise, pas depuis « maintenant » :
      // l'échéance de l'acompte part du même instant, et les deux restent d'accord.
      miseAJour.expireLe = expireConfirmationPour(await this.genreDeConfirmation(demande), horodatage);
    } else if (vers === "confirmee") {
      // Aucune coordonnée n'est fabriquée ici : elles sont saisies et
      // vérifiées par l'équipe. Une demande se confirme sans elles, et la
      // lecture les révèle quand elles existent.
      miseAJour.expireLe = undefined;
    } else if (vers === "refusee") {
      miseAJour.expireLe = undefined;
      miseAJour.motifRefus = options.motifRefus ?? "autre";
      miseAJour.coordonnees = undefined;
    } else if (vers === "annulee" || vers === "expiree" || vers === "terminee") {
      miseAJour.expireLe = undefined;
      if (vers !== "terminee") miseAJour.coordonnees = undefined;
    }

    // Un acompte demandé doit être payé et vérifié avant toute confirmation. La
    // table n'autorise que le visiteur à confirmer ; ce contrôle s'applique à
    // lui, et à quiconque pourrait un jour le faire.
    if (vers === "confirmee") {
      // L'offre d'abord : dire « déjà confirmée » à qui n'a pas payé vaut mieux que
      // « payez d'abord ». Indépendant de l'acompte, qui peut être fermé.
      await this.depot.exigerOffreLibre?.(id);
      if (this.acomptes) await this.acomptes.exigerPaiementVerifie(id);
    }

    // Conditionnelle au statut lu : si une autre transition est passée entre
    // la lecture et ici, `enregistrer` lève et rien de ce qui suit — acompte
    // compris — ne s'exécute.
    const enregistree = await this.depot.enregistrer(miseAJour, demande.statut);

    // L'acompte se prépare **après** que l'acceptation est écrite, et il ne
    // peut pas la défaire : `preparer` ne lève pas, et ce `catch` est là pour
    // le jour où quelqu'un l'oubliera. Le partenaire et l'équipe passent par
    // ici tous les deux — c'est le seul point d'acceptation.
    if (vers === "acceptee" && this.acomptes) {
      await this.acomptes.preparer(enregistree, horodatage).catch((erreur: unknown) => {
        this.logger.error(
          `Acompte de ${enregistree.reference} : ${(erreur as Error)?.message ?? "erreur inconnue"}`,
        );
      });
    }

    // Une demande qui meurt emporte son acompte : annulé s'il n'a rien reçu,
    // à rembourser s'il a reçu en partie. Même contrat que la préparation —
    // la transition est écrite, rien ici ne peut la défaire.
    if ((vers === "expiree" || vers === "annulee" || vers === "refusee") && this.acomptes) {
      await this.acomptes.synchroniserFinDeDemande(enregistree.id, vers).catch((erreur: unknown) => {
        this.logger.error(
          `Acompte de ${enregistree.reference} : ${(erreur as Error)?.message ?? "erreur inconnue"}`,
        );
      });
    }

    return enregistree;
  }

  /**
   * Le genre dont la demande acceptée reçoit la fenêtre de confirmation.
   *
   * Le contrat visiteur ne distingue que `logement` et `vehicule` ; la base
   * porte le genre fin. **Seule la location avec chauffeur** a sa propre
   * fenêtre (12 h, `DELAIS.location`) : un véhicule loué à la journée se
   * confirme comme un logement, pas à la course.
   *
   * Tout le reste reçoit **le délai du trajet (3 h)**, et deux de ces cas
   * s'écartent de `DELAIS` — voir « Écarts connus » dans `delais.ts` : le taxi
   * (15 min déclarées) et le service (12 h déclarées). Ils sont laissés tels
   * quels tant que leur règle n'est pas tranchée, et un test fige cet état.
   *
   * Le véhicule n'est bloqué par aucun code ici : la fenêtre ne fait qu'allonger
   * le temps avant l'expiration de la demande, donc celui pendant lequel le
   * partenaire doit garder le véhicule libre.
   */
  private async genreDeConfirmation(demande: Demande): Promise<"logement" | "location" | "trajet"> {
    if (demande.offre.genre === "logement") return "logement";
    const fin = await this.depot.genreDe?.(demande.id);
    return fin === "location" ? "location" : "trajet";
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
