import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { Acompte, Demande } from "@teranga/contracts";

import { DEPOT_ACOMPTES } from "../../commun/depots/depot";
import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { config, type ConfigAcompte } from "../../config/configuration";
import { STATUTS_DEMANDE_PAYABLES, type DepotAcomptes } from "./acomptes.depot";

/**
 * La configuration de l'acompte, injectable pour les tests.
 *
 * En production elle vient de `configuration.ts`, chargée et validée au
 * démarrage — fermée tant que `ACOMPTE_ACTIF` n'est pas posé.
 */
export const CONFIG_ACOMPTE = Symbol("ConfigAcompte");

/** Ce que l'envoi des instructions a donné. */
export type IssueInstructions =
  | "envoyees"
  /** Déjà parties : rien n'est renvoyé, le visiteur ne reçoit pas deux demandes. */
  | "deja_envoyees"
  /** Le dossier n'attend plus de virement : annulé, expiré, payé… */
  | "non_requises"
  /** Aucune adresse sur le compte du visiteur. */
  | "sans_destinataire"
  | "echec";

export type IssuePreparation =
  /** L'acompte n'est pas ouvert : verrou, taux ou coordonnées manquants. */
  | { etat: "desactive" }
  | { etat: "statut_incompatible" }
  | { etat: "non_eligible" }
  | { etat: "montant_nul" }
  /**
   * L'expiration de la demande ne laisse aucun délai de paiement.
   *
   * Aucun dossier n'est ouvert : mieux vaut ne rien réclamer que réclamer un
   * virement dont l'échéance est déjà passée.
   */
  | { etat: "echeance_invalide" }
  | { etat: "prepare"; acompteId: string; cree: boolean; instructions: IssueInstructions }
  | { etat: "erreur"; message: string };

/** Ce que la fin d'une demande a fait de son acompte. */
export type IssueFinDeDemande =
  | { etat: "sans_dossier" }
  | { etat: "annule" }
  | { etat: "a_rembourser"; montantRecu: number }
  /** Payé, expiré, déjà annulé ou remboursé : rien n'est touché. */
  | { etat: "inchange"; statut: Acompte["statut"] }
  | { etat: "erreur"; message: string };

/** Les fins de demande qui closent l'acompte. */
export type FinDeDemande = "expiree" | "annulee" | "refusee";

export interface DecisionPaiementTardif {
  /** Accepter le paiement, ou le rendre. */
  issue: "accepter" | "rembourser";
  acteurId: string;
  /** Ce qui a été vérifié — la disponibilité surtout. Obligatoire. */
  commentaire: string;
}

export interface ConstatRemboursement {
  acteurId: string;
  /** Le montant rendu, en FCFA entiers. */
  montant: number;
  referenceTransaction?: string;
  commentaire?: string;
}

/**
 * Le cycle de vie de l'acompte : préparation, instructions, décisions.
 *
 * Il ne **constate** jamais un paiement de lui-même — il ne voit pas la
 * banque. Il ne touche jamais une demande : ni son statut, ni son `expireLe`.
 * Et il n'exécute aucun remboursement : il consigne celui qu'une personne a
 * fait.
 */
@Injectable()
export class ServiceAcomptes {
  private readonly logger = new Logger(ServiceAcomptes.name);
  private readonly configAcompte: ConfigAcompte;

  constructor(
    @Inject(DEPOT_ACOMPTES) private readonly depot: DepotAcomptes,
    private readonly email: ServiceEmail,
    @Optional() @Inject(CONFIG_ACOMPTE) configAcompte?: ConfigAcompte,
  ) {
    this.configAcompte = configAcompte ?? config.acompte;
  }

  /**
   * Ouvre l'acompte d'une demande que le propriétaire vient d'accepter, et
   * envoie les instructions de virement.
   *
   * **Ne lève jamais.** La demande est acceptée et enregistrée quand on arrive
   * ici : un échec — base, Resend, n'importe quoi — se journalise et se rend,
   * il ne défait pas l'acceptation. Rejouée, elle ne crée pas de second
   * dossier et ne renvoie pas d'instructions déjà parties.
   *
   * `accepteeLe` est l'instant de l'acceptation : l'échéance se compte de là.
   */
  async preparer(demande: Demande, accepteeLe: Date): Promise<IssuePreparation> {
    try {
      const { actif, pourcentage, beneficiaire } = this.configAcompte;
      if (!actif || pourcentage === undefined || !beneficiaire) return { etat: "desactive" };

      if (demande.statut !== "acceptee") return { etat: "statut_incompatible" };
      // Le contrat ne distingue pas location, trajet et taxi : c'est le dépôt,
      // qui lit le genre en base, qui tranche pour un véhicule.
      if (demande.offre.genre === "service") return { etat: "non_eligible" };
      if (demande.prix.total <= 0) return { etat: "montant_nul" };

      let preparation;
      try {
        // L'instant d'acceptation, pas une échéance : le délai dépend du genre
        // fin — douze heures pour un logement, trois pour une location — que le
        // contrat visiteur ne distingue pas. C'est le dépôt qui le lit, donc lui
        // qui tranche, et qui plafonne par `expireLe`.
        preparation = await this.depot.preparer({
          demandeId: demande.id,
          pourcentage,
          accepteeLe: accepteeLe.toISOString(),
        });
      } catch (erreur) {
        const code = codeMetier(erreur);
        if (code === "ACOMPTE_GENRE_NON_ELIGIBLE") return { etat: "non_eligible" };
        if (code === "ACOMPTE_MONTANT_NUL") return { etat: "montant_nul" };
        if (code === "ACOMPTE_ECHEANCE_INVALIDE") return { etat: "echeance_invalide" };
        throw erreur;
      }

      const instructions = await this.envoyerInstructions(preparation.acompte.id);
      return {
        etat: "prepare",
        acompteId: preparation.acompte.id,
        cree: preparation.cree,
        instructions,
      };
    } catch (erreur) {
      const message = (erreur as Error)?.message ?? "erreur inconnue";
      this.logger.error(`Acompte de ${demande.reference} non préparé : ${message}`);
      return { etat: "erreur", message };
    }
  }

  /**
   * Envoie les instructions de virement, au plus une fois.
   *
   * Le marqueur n'est posé qu'après un envoi réussi : un échec laisse le
   * dossier sans `instructionsEnvoyeesLe`, consigné `envoi_echoue`, et prêt à
   * être renvoyé. L'inverse — marquer d'abord — transformerait un e-mail perdu
   * en paiement jamais réclamé.
   */
  async envoyerInstructions(acompteId: string): Promise<IssueInstructions> {
    const { beneficiaire, actif } = this.configAcompte;
    const contexte = await this.depot.contexte(acompteId);
    if (!contexte) throw introuvable("Acompte");
    const { acompte } = contexte;

    if (acompte.instructionsEnvoyeesLe) return "deja_envoyees";
    if (acompte.statut !== "en_attente") return "non_requises";
    // Le verrou peut s'être refermé entre la préparation et l'envoi : on ne
    // réclame rien sans lui.
    if (!actif || !beneficiaire) return "non_requises";

    if (!contexte.emailVisiteur) {
      this.logger.error(`Acompte de ${contexte.reference} : aucune adresse visiteur.`);
      await this.depot.consigner(acompteId, {
        type: "envoi_echoue",
        commentaire: "Aucune adresse e-mail sur le compte du visiteur.",
      });
      return "sans_destinataire";
    }

    const resultat = await this.email.envoyerInstructionsAcompte(
      contexte.emailVisiteur,
      {
        reference: contexte.reference,
        titre: contexte.titre,
        total: formaterFrancs(acompte.montantTotal),
        acompte: formaterFrancs(acompte.montantAttendu),
        pourcentage: acompte.pourcentageApplique,
        echeance: heureDeDakar(acompte.echeanceLe),
        beneficiaire,
      },
      { cleIdempotence: `acompte-instructions-${acompte.id}` },
    );

    if (!resultat.envoye) {
      await this.depot.consigner(acompteId, {
        type: "envoi_echoue",
        commentaire: `${resultat.erreur ?? "erreur inconnue"} (${resultat.tentatives} tentative(s))`,
      });
      return "echec";
    }

    await this.depot.marquerInstructionsEnvoyees(acompteId);
    return "envoyees";
  }

  /**
   * Clôt l'acompte d'une demande qui vient de mourir — expirée, annulée ou
   * refusée.
   *
   * Rien reçu : l'acompte est annulé, il ne faut plus virer. Reçu en partie :
   * il part en remboursement. Tout autre statut est laissé tel quel — un
   * acompte payé sur une demande qui meurt appelle une décision humaine, pas
   * un automatisme, et un acompte expiré a déjà son parcours.
   *
   * Pas d'e-mail ici : prévenir le visiteur de ne pas virer viendra plus tard.
   *
   * **Ne lève jamais** : la demande est déjà enregistrée dans son nouveau
   * statut, et cette synchronisation ne doit pas la faire échouer. Fonctionne
   * même acompte fermé : des dossiers ouverts avant la fermeture doivent
   * suivre leur demande.
   */
  async synchroniserFinDeDemande(demandeId: string, fin: FinDeDemande): Promise<IssueFinDeDemande> {
    try {
      const acompte = await this.depot.parDemande(demandeId);
      if (!acompte) return { etat: "sans_dossier" };

      const commentaire = `Demande ${fin} : l'acompte ne doit plus être réglé.`;

      if (acompte.statut === "en_attente") {
        await this.depot.changerStatut(
          acompte.id,
          { de: "en_attente", vers: "annule" },
          { type: "annulation", commentaire },
        );
        return { etat: "annule" };
      }

      if (acompte.statut === "partiel") {
        await this.depot.changerStatut(
          acompte.id,
          { de: "partiel", vers: "a_rembourser" },
          {
            type: "annulation",
            montant: acompte.montantRecu,
            commentaire: `Demande ${fin} : ${acompte.montantRecu} FCFA déjà reçus sont à rembourser.`,
          },
        );
        return { etat: "a_rembourser", montantRecu: acompte.montantRecu };
      }

      if (acompte.statut === "paye") {
        this.logger.warn(
          `Acompte ${acompte.id} payé sur une demande ${fin} : décision de remboursement à prendre.`,
        );
      }
      return { etat: "inchange", statut: acompte.statut };
    } catch (erreur) {
      const message = (erreur as Error)?.message ?? "erreur inconnue";
      this.logger.error(`Acompte de la demande ${demandeId} non synchronisé (${fin}) : ${message}`);
      return { etat: "erreur", message };
    }
  }

  /**
   * La décision humaine sur un paiement arrivé après l'échéance.
   *
   * Elle suppose que la réception a déjà été constatée sur le compte : on ne
   * décide pas d'accepter un argent que personne n'a vu. Accepter exige que la
   * demande soit encore vivante — elle n'est **jamais** rouverte pour l'occasion
   * — et que la personne ait écrit ce qu'elle a vérifié de la disponibilité.
   */
  async deciderPaiementTardif(acompteId: string, decision: DecisionPaiementTardif): Promise<Acompte> {
    if (!decision.commentaire?.trim()) {
      throw new ErreurMetier(
        "ACOMPTE_EXAMEN_REQUIS",
        "Un paiement tardif se décide après examen : dites ce qui a été vérifié.",
      );
    }
    const contexte = await this.depot.contexte(acompteId);
    if (!contexte) throw introuvable("Acompte");
    const { acompte } = contexte;

    if (acompte.statut !== "expire") {
      throw new ErreurMetier(
        "ACOMPTE_PAS_EN_RETARD",
        `L'acompte est « ${acompte.statut} » : il n'y a pas de paiement tardif à décider.`,
        HttpStatus.CONFLICT,
      );
    }
    if (acompte.montantRecu <= 0) {
      throw new ErreurMetier(
        "ACOMPTE_RIEN_RECU",
        "Aucune réception n'est constatée sur cet acompte : il n'y a rien à décider.",
        HttpStatus.CONFLICT,
      );
    }

    if (decision.issue === "rembourser") {
      return this.depot.changerStatut(
        acompteId,
        { de: "expire", vers: "a_rembourser" },
        {
          type: "remboursement_decide",
          montant: acompte.montantRecu,
          acteurId: decision.acteurId,
          commentaire: decision.commentaire,
        },
      );
    }

    if (acompte.montantRecu < acompte.montantAttendu) {
      throw new ErreurMetier(
        "ACOMPTE_PAIEMENT_INCOMPLET",
        `${acompte.montantRecu} FCFA reçus sur ${acompte.montantAttendu} : le paiement n'est pas complet.`,
        HttpStatus.CONFLICT,
      );
    }
    // Le dépôt refuse aussi, au moment d'écrire : ce contrôle-ci donne
    // seulement l'erreur avant d'ouvrir une transaction.
    if (!STATUTS_DEMANDE_PAYABLES.includes(contexte.statutDemande)) {
      throw new ErreurMetier(
        "ACOMPTE_DEMANDE_CLOSE",
        `La demande est « ${contexte.statutDemande} » : le paiement ne peut qu'être remboursé.`,
        HttpStatus.CONFLICT,
      );
    }

    return this.depot.changerStatut(
      acompteId,
      { de: "expire", vers: "paye" },
      { type: "verification", acteurId: decision.acteurId, commentaire: decision.commentaire },
    );
  }

  /**
   * Consigne un remboursement **déjà exécuté** par une personne.
   *
   * Rien ne part d'ici : aucune banque n'est appelée. C'est le constat qui
   * fait passer l'acompte à son statut final.
   */
  confirmerRemboursement(acompteId: string, constat: ConstatRemboursement): Promise<Acompte> {
    return this.depot.changerStatut(
      acompteId,
      { de: "a_rembourser", vers: "rembourse" },
      {
        type: "remboursement_effectue",
        montant: constat.montant,
        acteurId: constat.acteurId,
        referenceTransaction: constat.referenceTransaction,
        commentaire: constat.commentaire,
      },
    );
  }
}

function codeMetier(erreur: unknown): string | undefined {
  if (!(erreur instanceof ErreurMetier)) return undefined;
  return (erreur.getResponse() as { code?: string }).code;
}

/** Le montant en francs, tel que le visiteur le recopiera dans son virement. */
function formaterFrancs(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant).replace(/ | /g, " ")} FCFA`;
}

/**
 * « 2 novembre à 08:00 » — l'heure de Dakar, quelle que soit celle du serveur.
 * Une échéance lue à l'heure du conteneur ferait virer trop tard.
 */
function heureDeDakar(iso: string): string {
  const quand = new Date(iso);
  const jour = quand.toLocaleDateString("fr-FR", { timeZone: "Africa/Dakar", day: "numeric", month: "long" });
  const heure = quand.toLocaleTimeString("fr-FR", {
    timeZone: "Africa/Dakar",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${jour} à ${heure}`;
}
