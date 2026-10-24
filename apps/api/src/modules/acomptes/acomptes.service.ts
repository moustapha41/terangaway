import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type {
  Acompte,
  Demande,
  EtatEnvoiAcompte,
  ResultatReceptionAcompte,
  SaisieReceptionAcompte,
  StatutDemande,
  VueAcompteAdmin,
} from "@teranga/contracts";

import { DEPOT_ACOMPTES } from "../../commun/depots/depot";
import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { config, type ConfigAcompte } from "../../config/configuration";
import { STATUTS_DEMANDE_PAYABLES, type DepotAcomptes } from "./acomptes.depot";
import { genreEligibleAcompte, montantAcompte } from "./calcul";
import { acompteNonPaye } from "./erreurs";
import { coordonneesPaiement } from "./paiement";

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
  /**
   * Une autre demande confirmée occupe déjà cette offre sur des dates qui recouvrent
   * les siennes. Aucun dossier n'est ouvert et aucune instruction n'est envoyée :
   * réclamer un acompte pour une offre prise, c'est encaisser pour rien.
   */
  | { etat: "offre_deja_confirmee" }
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

/**
 * Le statut de la demande, dit au visiteur : le seul fait que l'e-mail de
 * réception puisse affirmer sur la réservation — celui que la base porte.
 */
const STATUT_RESERVATION: Record<StatutDemande, string> = {
  envoyee: "demande envoyée, en attente de réponse du propriétaire",
  acceptee: "acceptée par le propriétaire, pas encore confirmée",
  confirmee: "confirmée",
  terminee: "terminée",
  refusee: "refusée",
  expiree: "expirée",
  annulee: "annulée",
};

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
    return this.preparerPour(
      {
        id: demande.id,
        reference: demande.reference,
        statut: demande.statut,
        genre: demande.offre.genre,
        total: demande.prix.total,
      },
      accepteeLe,
    );
  }

  /**
   * Ouvre le dossier d'une demande déjà acceptée, à la demande de l'équipe.
   *
   * Pour le cas où l'acompte n'était pas ouvert à l'acceptation : la demande
   * est relue en base, jamais prise d'un navigateur. Mêmes règles que
   * `preparer`, qui reste la seule à décider.
   */
  async ouvrir(demandeId: string): Promise<IssuePreparation> {
    const demande = await this.depot.lireDemande(demandeId);
    if (!demande) throw introuvable("Demande");
    return this.preparerPour(
      {
        id: demandeId,
        reference: demande.reference,
        statut: demande.statutDemande,
        genre: demande.genre,
        total: demande.prixTotal,
      },
      new Date(),
    );
  }

  private async preparerPour(
    demande: { id: string; reference: string; statut: StatutDemande; genre: string; total: number },
    accepteeLe: Date,
  ): Promise<IssuePreparation> {
    try {
      const { actif, pourcentage } = this.configAcompte;
      if (!actif || pourcentage === undefined || !coordonneesPaiement(this.configAcompte)) {
        return { etat: "desactive" };
      }

      if (demande.statut !== "acceptee") return { etat: "statut_incompatible" };
      // Le contrat ne distingue pas location, trajet et taxi : c'est le dépôt,
      // qui lit le genre en base, qui tranche pour un véhicule.
      if (demande.genre === "service") return { etat: "non_eligible" };
      if (demande.total <= 0) return { etat: "montant_nul" };

      // Un dossier déjà ouvert reste ce qu'il est — la préparation est idempotente et
      // ne reprend pas ce qui a été annoncé. Seule une ouverture *nouvelle* est refusée
      // quand l'offre est prise. Ce contrôle évite d'encaisser pour rien ; la garde
      // qui fait foi est celle de la confirmation, sous verrou.
      if (!(await this.depot.parDemande(demande.id)) && (await this.depot.offreDejaConfirmee(demande.id))) {
        return { etat: "offre_deja_confirmee" };
      }

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
  async envoyerInstructions(
    acompteId: string,
    options: { renvoi?: { acteurId: string } } = {},
  ): Promise<IssueInstructions> {
    const { actif } = this.configAcompte;
    const coordonnees = coordonneesPaiement(this.configAcompte);
    const contexte = await this.depot.contexte(acompteId);
    if (!contexte) throw introuvable("Acompte");
    const { acompte } = contexte;
    const renvoi = options.renvoi;

    // Un renvoi est un geste explicite de l'équipe : il passe outre le marqueur
    // « déjà parties », mais jamais outre l'état du dossier.
    if (acompte.instructionsEnvoyeesLe && !renvoi) return "deja_envoyees";
    const attendu = renvoi ? ["en_attente", "partiel"] : ["en_attente"];
    if (!attendu.includes(acompte.statut)) return "non_requises";
    // Le verrou peut s'être refermé entre la préparation et l'envoi : on ne
    // réclame rien sans lui.
    if (!actif || !coordonnees) return "non_requises";

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
        beneficiaire: coordonnees.virement,
        mobileMoney: coordonnees.mobileMoney,
        instructions: coordonnees.instructions,
      },
      {
        // Le renvoi a sa propre clé, à la minute : un double clic ne double pas
        // l'envoi, mais un second renvoi voulu, plus tard, part bien.
        cleIdempotence: renvoi
          ? `acompte-instructions-${acompte.id}-renvoi-${minuteCourante()}`
          : `acompte-instructions-${acompte.id}`,
      },
    );

    if (!resultat.envoye) {
      await this.depot.consigner(acompteId, {
        type: "envoi_echoue",
        acteurId: renvoi?.acteurId,
        commentaire: `${resultat.erreur ?? "erreur inconnue"} (${resultat.tentatives} tentative(s))`,
      });
      return "echec";
    }

    await this.depot.marquerInstructionsEnvoyees(acompteId);
    if (renvoi) {
      await this.depot.consigner(acompteId, {
        type: "instructions_envoyees",
        acteurId: renvoi.acteurId,
        commentaire: "Instructions renvoyées à la demande de l'équipe.",
      });
    }
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
        try {
          // Le montant du journal est relu sous verrou : il est celui du dossier
          // au moment de la décision, pas celui qu'on a lu une ligne plus haut.
          const rendu = await this.depot.declarerARembourser({
            acompteId: acompte.id,
            depuisStatuts: ["partiel"],
            type: "annulation",
            commentaire: `Demande ${fin} : l'argent déjà reçu est à rembourser.`,
          });
          return { etat: "a_rembourser", montantRecu: rendu.montantRecu };
        } catch (erreur) {
          // Le dossier a changé entre la lecture et le verrou (un complément a
          // fini de le payer) : il ne part pas d'office, et l'écran d'équipe le
          // montrera comme tout acompte payé sur une demande morte.
          if (codeMetier(erreur) !== "ACOMPTE_RIEN_A_REMBOURSER") throw erreur;
          const relu = await this.depot.parDemande(demandeId);
          return { etat: "inchange", statut: relu?.statut ?? acompte.statut };
        }
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
      // Un versement tardif peut encore arriver pendant qu'on décide : le cumul
      // décidé est celui relu sous verrou.
      return this.depot.declarerARembourser({
        acompteId,
        depuisStatuts: ["expire"],
        type: "remboursement_decide",
        acteurId: decision.acteurId,
        commentaire: decision.commentaire,
      });
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
   * La réservation ne se confirme pas tant que l'acompte demandé n'est pas
   * payé **et vérifié**.
   *
   * Sans dossier, rien n'a été demandé et rien n'est exigé : acompte fermé au
   * moment de l'acceptation, ou genre non éligible. Avec un dossier, seul
   * « payé » laisse passer — « partiel », « en attente », « expiré » ou
   * « à rembourser » refusent. Une déclaration du visiteur ou une capture
   * d'écran n'y change rien : ce statut ne se pose que par le constat d'un
   * administrateur.
   *
   * Cette règle **restreint** la confirmation, elle n'en déclenche aucune : un
   * paiement vérifié ne confirme toujours pas la réservation, c'est le visiteur
   * qui la confirme. La lecture échoue fermée : si le dossier est illisible,
   * l'erreur remonte et la confirmation n'a pas lieu.
   */
  async exigerPaiementVerifie(demandeId: string): Promise<void> {
    const dossier = await this.depot.parDemande(demandeId);
    if (!dossier || dossier.statut === "paye") return;
    throw acompteNonPaye();
  }

  /**
   * Tout ce que l'écran d'équipe affiche sur l'acompte d'une demande.
   *
   * Lecture seule. Les drapeaux d'`actions` disent ce que la machine à états
   * permet maintenant ; chaque écriture les revérifie, dans sa transaction.
   */
  async lireVue(demandeId: string): Promise<VueAcompteAdmin> {
    const demande = await this.depot.lireDemande(demandeId);
    if (!demande) throw introuvable("Demande");

    const acompte = (await this.depot.parDemande(demandeId)) ?? undefined;
    const journal = acompte ? await this.depot.journal(acompte.id) : [];
    const ids = [...new Set(journal.map((e) => e.acteurId).filter((id): id is string => !!id))];
    const acteurs = await this.depot.nomsActeurs(ids);

    const coordonnees = coordonneesPaiement(this.configAcompte);
    const { pourcentage } = this.configAcompte;
    const actif = this.configAcompte.actif && pourcentage !== undefined && coordonnees !== undefined;
    const payable = (STATUTS_DEMANDE_PAYABLES as readonly string[]).includes(demande.statutDemande);

    let apercu: VueAcompteAdmin["apercu"];
    if (!acompte && actif && genreEligibleAcompte(demande.genre) && demande.prixTotal > 0) {
      const montantAttendu = montantAcompte(demande.prixTotal, pourcentage!);
      apercu = {
        pourcentage: pourcentage!,
        montantTotal: demande.prixTotal,
        montantAttendu,
        solde: demande.prixTotal - montantAttendu,
      };
    }

    // Sans dossier, l'équipe doit savoir pourquoi l'acompte ne s'ouvre pas.
    const offreDejaConfirmee = acompte ? false : await this.depot.offreDejaConfirmee(demandeId);

    const statut = acompte?.statut;
    return {
      actif,
      offreDejaConfirmee,
      statutDemande: demande.statutDemande,
      acompte,
      apercu,
      resteDu: acompte ? Math.max(acompte.montantAttendu - acompte.montantRecu, 0) : undefined,
      soldeApresAcompte: acompte ? Math.max(acompte.montantTotal - acompte.montantAttendu, 0) : undefined,
      // Visibles à l'équipe seule, jamais au visiteur ni dans un journal.
      coordonnees: acompte || actif ? coordonnees : undefined,
      journal,
      acteurs,
      actions: {
        preparer:
          !acompte && !offreDejaConfirmee && apercu !== undefined && demande.statutDemande === "acceptee",
        confirmerReception:
          statut === "expire" || ((statut === "en_attente" || statut === "partiel") && payable),
        renvoyerInstructions: actif && (statut === "en_attente" || statut === "partiel"),
        renvoyerConfirmation: (statut === "paye" || statut === "partiel") && (acompte?.montantRecu ?? 0) > 0,
        deciderPaiementTardif: statut === "expire" && (acompte?.montantRecu ?? 0) > 0,
        deciderRemboursement: (statut === "paye" || statut === "partiel") && (acompte?.montantRecu ?? 0) > 0,
        constaterRemboursement: statut === "a_rembourser" && (acompte?.montantRecu ?? 0) > 0,
      },
    };
  }

  /**
   * Constate un versement qu'une personne a vérifié sur le compte, et prévient
   * le visiteur.
   *
   * La déclaration d'un client, une
   * capture d'écran ne passent par aucune de ces lignes. Le montant vient de
   * la personne, le contrôle d'écart, la concurrence et le statut du dépôt.
   *
   * L'e-mail part **après** l'enregistrement et ne l'annule jamais : son échec
   * est consigné et le renvoi (`renvoyerConfirmation`) ne compte rien de plus.
   */
  async confirmerReception(
    demandeId: string,
    saisie: SaisieReceptionAcompte,
    acteurId: string,
  ): Promise<ResultatReceptionAcompte> {
    const dossier = await this.depot.parDemande(demandeId);
    if (!dossier) throw introuvable("Acompte");

    const resultat = await this.depot.enregistrerReception({
      acompteId: dossier.id,
      montant: saisie.montant,
      montantRecuAvant: saisie.montantRecuAvant,
      acteurId,
      referenceTransaction: saisie.referenceTransaction,
      commentaire: saisie.commentaire,
      ecartConfirme: saisie.ecartConfirme === true,
    });

    // Reçu après l'échéance : l'argent est consigné, la décision reste à
    // prendre (`deciderPaiementTardif`). Écrire « reçu et vérifié » au
    // visiteur maintenant lui promettrait une réservation qu'on n'a pas décidée.
    const emailConfirmation: EtatEnvoiAcompte = resultat.tardive
      ? "non_requis"
      : await this.envoyerConfirmation(dossier.id, undefined);

    return {
      acompte: resultat.acompte,
      sens: resultat.sens,
      ecart: resultat.ecart,
      emailConfirmation,
    };
  }

  /**
   * Renvoie l'e-mail de réception, sans rien compter : le cumul ne bouge pas.
   * Seuls un dossier payé ou partiel, avec de l'argent réellement constaté,
   * en ont un à renvoyer.
   */
  async renvoyerConfirmation(demandeId: string, acteurId: string): Promise<EtatEnvoiAcompte> {
    const dossier = await this.depot.parDemande(demandeId);
    if (!dossier) throw introuvable("Acompte");
    if (!(dossier.statut === "paye" || dossier.statut === "partiel") || dossier.montantRecu <= 0) {
      throw new ErreurMetier(
        "ACOMPTE_RIEN_A_CONFIRMER",
        `L'acompte est « ${dossier.statut} » avec ${dossier.montantRecu} FCFA reçus : aucune confirmation à renvoyer.`,
        HttpStatus.CONFLICT,
      );
    }
    return this.envoyerConfirmation(dossier.id, { acteurId });
  }

  /** Renvoie les instructions de paiement d'un dossier encore attendu. */
  async renvoyerInstructionsPourDemande(demandeId: string, acteurId: string): Promise<IssueInstructions> {
    const dossier = await this.depot.parDemande(demandeId);
    if (!dossier) throw introuvable("Acompte");
    return this.envoyerInstructions(dossier.id, { renvoi: { acteurId } });
  }

  /**
   * L'e-mail « reçu et vérifié », composé de l'état **enregistré** : cumul,
   * reste et statut de la demande viennent de la base, pas de l'appelant.
   * Ne lève jamais.
   */
  private async envoyerConfirmation(
    acompteId: string,
    renvoi: { acteurId: string } | undefined,
  ): Promise<EtatEnvoiAcompte> {
    try {
      const contexte = await this.depot.contexte(acompteId);
      if (!contexte) return "echec";
      const { acompte } = contexte;

      if (!contexte.emailVisiteur) {
        await this.depot.consigner(acompteId, {
          type: "envoi_echoue",
          acteurId: renvoi?.acteurId,
          commentaire: "Confirmation de réception : aucune adresse e-mail sur le compte du visiteur.",
        });
        return "sans_destinataire";
      }

      const journal = await this.depot.journal(acompteId);
      const derniere = [...journal].reverse().find((e) => e.type === "reception_confirmee");
      const versement = derniere?.montant ?? acompte.montantRecu;

      const reste = acompte.montantAttendu - acompte.montantRecu;
      const resultat = await this.email.envoyerReceptionAcompte(
        contexte.emailVisiteur,
        {
          reference: contexte.reference,
          titre: contexte.titre,
          montantRecu: formaterFrancs(versement),
          cumulRecu: formaterFrancs(acompte.montantRecu),
          acompteAttendu: formaterFrancs(acompte.montantAttendu),
          resteAcompte: reste > 0 ? formaterFrancs(reste) : undefined,
          surplus: reste < 0 ? formaterFrancs(-reste) : undefined,
          soldeSejour: formaterFrancs(Math.max(acompte.montantTotal - acompte.montantAttendu, 0)),
          dateValidation: heureDeDakar(derniere?.creeLe ?? acompte.misAJourLe),
          statutReservation: STATUT_RESERVATION[contexte.statutDemande],
          reservationConfirmee: contexte.statutDemande === "confirmee",
          confirmationAttendue: contexte.statutDemande === "acceptee",
        },
        {
          // Une confirmation automatique est rejouable à l'identique ; un
          // renvoi voulu a sa clé, à la minute.
          cleIdempotence: renvoi
            ? `acompte-reception-${acompteId}-${acompte.montantRecu}-renvoi-${minuteCourante()}`
            : `acompte-reception-${acompteId}-${acompte.montantRecu}`,
        },
      );

      if (!resultat.envoye) {
        await this.depot.consigner(acompteId, {
          type: "envoi_echoue",
          acteurId: renvoi?.acteurId,
          commentaire: `Confirmation de réception non envoyée : ${resultat.erreur ?? "erreur inconnue"} (${resultat.tentatives} tentative(s))`,
        });
        return "echec";
      }
      return "envoye";
    } catch (erreur) {
      this.logger.error(
        `Confirmation de réception de l'acompte ${acompteId} non envoyée : ${(erreur as Error)?.message}`,
      );
      return "echec";
    }
  }

  /**
   * Décide qu'un acompte payé ou partiel doit être rendu.
   *
   * C'est une **décision**, pas un transfert : rien ne part vers une banque, et
   * aucun délai n'est promis au visiteur. Elle sort l'acompte des statuts où
   * une réception s'enregistre — plus rien ne s'y ajoute — et l'inscrit dans la
   * file « à rembourser ». Le motif est obligatoire : on ne rend pas de
   * l'argent sans dire pourquoi.
   *
   * Un remboursement est toujours **intégral** : le cumul reçu. Un remboursement
   * partiel — rendre un surplus, garder l'acompte — n'est pas modélisé.
   */
  async deciderRemboursement(
    demandeId: string,
    decision: { acteurId: string; commentaire: string },
  ): Promise<Acompte> {
    if (!decision.commentaire?.trim()) {
      throw new ErreurMetier(
        "ACOMPTE_MOTIF_REQUIS",
        "Un remboursement se décide avec son motif : dites pourquoi l'acompte est rendu.",
      );
    }
    const dossier = await this.depot.parDemande(demandeId);
    if (!dossier) throw introuvable("Acompte");
    // Le statut et le cumul sont jugés par le dépôt, sous le verrou du dossier :
    // une réception partielle qui arrive en même temps passe avant (la décision
    // porte alors sur le cumul complet) ou après (elle est refusée). Lire ici
    // puis écrire plus loin laisserait un montant périmé au journal.
    return this.depot.declarerARembourser({
      acompteId: dossier.id,
      depuisStatuts: ["paye", "partiel"],
      type: "remboursement_decide",
      acteurId: decision.acteurId,
      commentaire: decision.commentaire.trim(),
    });
  }

  /**
   * Consigne qu'une personne a **rendu** l'argent d'un acompte « à rembourser ».
   *
   * Le montant est relu en base et doit être exactement le cumul reçu : un
   * remboursement partiel n'est pas modélisé, et un montant saisi de travers
   * ne doit pas clore un dossier. Rien n'est exécuté ici — aucune banque,
   * aucun opérateur n'est appelé ; la personne a fait le transfert ailleurs.
   * « Remboursé » est final : un second constat reçoit un conflit.
   */
  async constaterRemboursement(
    demandeId: string,
    constat: ConstatRemboursement,
  ): Promise<Acompte> {
    const dossier = await this.depot.parDemande(demandeId);
    if (!dossier) throw introuvable("Acompte");
    if (dossier.statut !== "a_rembourser") {
      throw new ErreurMetier(
        "ACOMPTE_NON_A_REMBOURSER",
        `L'acompte est « ${dossier.statut} » : il n'y a pas de remboursement décidé à constater.`,
        HttpStatus.CONFLICT,
      );
    }
    if (constat.montant !== dossier.montantRecu) {
      throw new ErreurMetier(
        "ACOMPTE_REMBOURSEMENT_MONTANT",
        `Le remboursement porte sur la totalité du cumul reçu (${dossier.montantRecu} FCFA) : ` +
          `${constat.montant} FCFA saisis. Les remboursements partiels ne sont pas pris en charge.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.confirmerRemboursement(dossier.id, constat);
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

/** Un numéro de minute : sépare un double clic d'un second renvoi voulu. */
function minuteCourante(): number {
  return Math.floor(Date.now() / 60_000);
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
