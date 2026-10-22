import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DepositPayment, DepositPaymentEvent } from "@prisma/client";
import type { Acompte, EvenementAcompte } from "@teranga/contracts";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import type {
  ContexteAcompte,
  DepotAcomptes,
  EntreeEvenementAcompte,
  EntreePreparationAcompte,
  ResultatPreparationAcompte,
  TransitionAcompte,
} from "./acomptes.depot";
import { STATUTS_DEMANDE_PAYABLES, transitionAcompteAutorisee } from "./acomptes.depot";
import {
  echeanceAcompte,
  genreEligibleAcompte,
  montantAcompte,
  pourcentageValide,
} from "./calcul";

/**
 * Ce qu'il faut lire avec un dossier pour en faire un `Acompte`.
 *
 * Le motif de virement est `Demand.reference`, pas une copie. Qui a confirmé,
 * quand et avec quelle référence bancaire se lit sur la dernière réception du
 * journal : des colonnes sur le dossier seraient écrasées par un second
 * versement, le journal ne l'est pas.
 */
const INCLUSION_ACOMPTE = {
  demande: { select: { reference: true } },
  evenements: {
    where: { type: "reception_confirmee" },
    orderBy: [{ creeLe: "desc" }, { id: "desc" }],
    take: 1,
  },
} satisfies Prisma.DepositPaymentInclude;

type LigneAcompte = DepositPayment & {
  demande: { reference: string };
  evenements: DepositPaymentEvent[];
};

type Transaction = Prisma.TransactionClient;

function versAcompte(ligne: LigneAcompte): Acompte {
  const reception = ligne.evenements[0];
  return {
    id: ligne.id,
    demandeId: ligne.demandeId,
    referenceVirement: ligne.demande.reference,
    statut: ligne.statut,
    pourcentageApplique: ligne.pourcentageApplique,
    montantTotal: ligne.montantTotal,
    montantAttendu: ligne.montantAttendu,
    montantRecu: ligne.montantRecu,
    // Toute la plateforme compte en francs CFA : `prixTotal` n'a pas de
    // devise non plus. Une colonne qui vaudrait toujours « XOF » ne dirait rien.
    devise: "XOF",
    echeanceLe: ligne.echeanceLe.toISOString(),
    instructionsEnvoyeesLe: ligne.instructionsEnvoyeesLe?.toISOString(),
    rappeleLe: ligne.rappeleLe?.toISOString(),
    confirmeParId: reception?.acteurId ?? undefined,
    confirmeLe: reception?.creeLe.toISOString(),
    referenceTransaction: reception?.referenceTransaction ?? undefined,
    creeLe: ligne.creeLe.toISOString(),
    misAJourLe: ligne.misAJourLe.toISOString(),
  };
}

function versEvenement(ligne: DepositPaymentEvent): EvenementAcompte {
  return {
    id: ligne.id,
    acompteId: ligne.acompteId,
    type: ligne.type,
    statutAvant: ligne.statutAvant ?? undefined,
    statutApres: ligne.statutApres ?? undefined,
    montant: ligne.montant ?? undefined,
    acteurId: ligne.acteurId ?? undefined,
    referenceTransaction: ligne.referenceTransaction ?? undefined,
    commentaire: ligne.commentaire ?? undefined,
    creeLe: ligne.creeLe.toISOString(),
  };
}

const evenementInvalide = (message: string) =>
  new ErreurMetier("ACOMPTE_EVENEMENT_INVALIDE", message);

/**
 * Un événement se refuse avant d'atteindre la base, quand il ne raconte rien
 * de vérifiable.
 *
 * Une réception sans montant ou sans personne pour l'avoir constatée n'en est
 * pas une : le système ne voit pas la banque, il ne peut rien confirmer seul.
 * Le statut ne se pose que par `changerStatut`, jamais par un événement nu.
 */
function verifierEvenement(evenement: EntreeEvenementAcompte): void {
  if (
    evenement.montant !== undefined &&
    (!Number.isInteger(evenement.montant) || evenement.montant <= 0)
  ) {
    throw evenementInvalide("Le montant d'un événement est un entier strictement positif.");
  }
  if (evenement.type === "preparation") {
    throw evenementInvalide("La préparation ne se consigne que par `preparer`.");
  }
  if (evenement.type === "reception_confirmee") {
    if (evenement.montant === undefined) {
      throw evenementInvalide("Une réception confirmée porte un montant.");
    }
    if (!evenement.acteurId) {
      throw evenementInvalide("Une réception est constatée par une personne, jamais par le système.");
    }
  }
}

/**
 * Les conditions d'un franchissement que la table seule ne dit pas.
 *
 * Une preuve déclarée ne fait jamais passer un acompte à « payé » : seul ce
 * qu'une personne a constaté sur le compte le peut. Et l'argent rendu ne se
 * déclare pas sur une intention.
 */
function verifierFranchissement(transition: TransitionAcompte, evenement: EntreeEvenementAcompte): void {
  if (transition.vers === "paye") {
    if (!evenement.acteurId) {
      throw evenementInvalide("Un acompte n'est déclaré payé que par une personne nommée.");
    }
    if (evenement.type !== "reception_confirmee" && evenement.type !== "verification") {
      throw evenementInvalide(
        "Un acompte ne passe à « payé » que sur une réception constatée ou une vérification.",
      );
    }
    if (transition.de === "expire" && (evenement.type !== "verification" || !evenement.commentaire?.trim())) {
      throw evenementInvalide(
        "Un paiement tardif ne s'accepte qu'après un examen consigné : vérification signée et commentée.",
      );
    }
  }
  if (transition.vers === "rembourse") {
    if (
      evenement.type !== "remboursement_effectue" ||
      !evenement.acteurId ||
      evenement.montant === undefined
    ) {
      throw evenementInvalide(
        "« Remboursé » exige un remboursement effectué, chiffré et constaté par une personne.",
      );
    }
  }
}

function estViolationUnicite(erreur: unknown): boolean {
  return erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002";
}

@Injectable()
export class DepotAcomptesPrisma implements DepotAcomptes {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async preparer(entree: EntreePreparationAcompte): Promise<ResultatPreparationAcompte> {
    const existant = await this.parDemande(entree.demandeId);
    if (existant) return { acompte: existant, cree: false };

    if (!pourcentageValide(entree.pourcentage)) {
      throw new ErreurMetier(
        "ACOMPTE_TAUX_INVALIDE",
        "Le taux d'acompte doit être un entier de 1 à 100.",
      );
    }
    // Lue, jamais écrite : le dossier vit à côté de la demande, il ne la
    // touche pas — ni son statut, ni son `expireLe`, ni sa date de mise à jour.
    const demande = await this.prisma.demand.findUnique({
      where: { id: entree.demandeId },
      select: { genre: true, prixTotal: true, expireLe: true },
    });
    if (!demande) throw introuvable("Demande");

    if (!genreEligibleAcompte(demande.genre)) {
      throw new ErreurMetier(
        "ACOMPTE_GENRE_NON_ELIGIBLE",
        `Une demande de genre « ${demande.genre} » ne donne pas lieu à un acompte.`,
      );
    }

    // L'échéance se déduit **ici**, du genre que seule la base porte : douze
    // heures pour un logement, trois pour une location, et jamais au-delà de
    // l'expiration de la demande. Le calcul est celui de `calcul.ts`, pur ; on
    // ne fait que traduire son refus en erreur métier.
    let echeanceLe: Date;
    try {
      echeanceLe = new Date(
        echeanceAcompte(demande.genre, entree.accepteeLe, demande.expireLe?.toISOString()),
      );
    } catch (erreur) {
      throw new ErreurMetier(
        "ACOMPTE_ECHEANCE_INVALIDE",
        (erreur as Error)?.message ?? "L'échéance de l'acompte est invalide.",
      );
    }

    const montantAttendu = montantAcompte(demande.prixTotal, entree.pourcentage);
    if (montantAttendu <= 0) {
      throw new ErreurMetier(
        "ACOMPTE_MONTANT_NUL",
        "Le total de la demande est nul : il n'y a pas d'acompte à demander.",
      );
    }

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const cree = await tx.depositPayment.create({
          data: {
            demandeId: entree.demandeId,
            pourcentageApplique: entree.pourcentage,
            montantTotal: demande.prixTotal,
            montantAttendu,
            echeanceLe,
          },
        });
        await tx.depositPaymentEvent.create({
          data: {
            acompteId: cree.id,
            type: "preparation",
            statutApres: cree.statut,
            montant: montantAttendu,
          },
        });
        return cree.id;
      });
      return { acompte: (await this.parId(id))!, cree: true };
    } catch (erreur) {
      // Une préparation concurrente a gagné la course : la contrainte
      // d'unicité sur `demandeId` a fait son travail, on rend son dossier.
      if (estViolationUnicite(erreur)) {
        const gagnant = await this.parDemande(entree.demandeId);
        if (gagnant) return { acompte: gagnant, cree: false };
      }
      throw erreur;
    }
  }

  async parId(id: string): Promise<Acompte | null> {
    const ligne = await this.prisma.depositPayment.findUnique({
      where: { id },
      include: INCLUSION_ACOMPTE,
    });
    return ligne ? versAcompte(ligne) : null;
  }

  async parDemande(demandeId: string): Promise<Acompte | null> {
    const ligne = await this.prisma.depositPayment.findUnique({
      where: { demandeId },
      include: INCLUSION_ACOMPTE,
    });
    return ligne ? versAcompte(ligne) : null;
  }

  async changerStatut(
    acompteId: string,
    transition: TransitionAcompte,
    evenement: EntreeEvenementAcompte,
  ): Promise<Acompte> {
    verifierEvenement(evenement);
    if (!transitionAcompteAutorisee(transition.de, transition.vers)) {
      throw new ErreurMetier(
        "ACOMPTE_TRANSITION_INTERDITE",
        `Un acompte ne passe pas de « ${transition.de} » à « ${transition.vers} ».`,
        HttpStatus.CONFLICT,
      );
    }
    verifierFranchissement(transition, evenement);

    await this.prisma.$transaction(async (tx) => {
      if (transition.vers === "paye") await this.exigerDemandePayable(tx, acompteId);

      // Comparer-et-poser : l'écriture n'aboutit que si le statut est encore
      // celui qu'on a lu. Deux administrateurs qui confirment en même temps
      // ne s'écrasent pas — le second reçoit un conflit.
      const { count } = await tx.depositPayment.updateMany({
        where: { id: acompteId, statut: transition.de },
        data: {
          statut: transition.vers,
          ...this.incrementRecu(evenement),
        },
      });
      if (count === 0) await this.expliquerEchec(tx, acompteId);

      const apres = await tx.depositPayment.findUniqueOrThrow({ where: { id: acompteId } });
      this.verifierCoherence(apres);

      await tx.depositPaymentEvent.create({
        data: {
          ...this.donneesEvenement(acompteId, evenement),
          statutAvant: transition.de,
          statutApres: transition.vers,
        },
      });
    });

    return (await this.parId(acompteId))!;
  }

  async consigner(
    acompteId: string,
    evenement: EntreeEvenementAcompte,
  ): Promise<EvenementAcompte> {
    verifierEvenement(evenement);

    const ligne = await this.prisma.$transaction(async (tx) => {
      const increment = this.incrementRecu(evenement);
      if (increment.montantRecu) {
        const { count } = await tx.depositPayment.updateMany({
          where: { id: acompteId },
          data: increment,
        });
        if (count === 0) throw introuvable("Acompte");
      } else if (!(await tx.depositPayment.findUnique({ where: { id: acompteId }, select: { id: true } }))) {
        throw introuvable("Acompte");
      }
      return tx.depositPaymentEvent.create({ data: this.donneesEvenement(acompteId, evenement) });
    });

    return versEvenement(ligne);
  }

  async journal(acompteId: string): Promise<EvenementAcompte[]> {
    const lignes = await this.prisma.depositPaymentEvent.findMany({
      where: { acompteId },
      orderBy: [{ creeLe: "asc" }, { id: "asc" }],
    });
    return lignes.map(versEvenement);
  }

  async contexte(acompteId: string): Promise<ContexteAcompte | null> {
    const ligne = await this.prisma.depositPayment.findUnique({
      where: { id: acompteId },
      include: {
        ...INCLUSION_ACOMPTE,
        demande: {
          select: {
            reference: true,
            offreTitre: true,
            statut: true,
            visiteur: { select: { email: true } },
          },
        },
      },
    });
    if (!ligne) return null;
    return {
      acompte: versAcompte(ligne),
      reference: ligne.demande.reference,
      titre: ligne.demande.offreTitre,
      statutDemande: ligne.demande.statut,
      emailVisiteur: ligne.demande.visiteur.email ?? undefined,
    };
  }

  async marquerInstructionsEnvoyees(acompteId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Posé une fois : le second appel, concurrent ou rejoué, ne trouve plus
      // de ligne à marquer et n'écrit rien au journal.
      const { count } = await tx.depositPayment.updateMany({
        where: { id: acompteId, instructionsEnvoyeesLe: null },
        data: { instructionsEnvoyeesLe: new Date() },
      });
      if (count === 0) {
        const existe = await tx.depositPayment.findUnique({ where: { id: acompteId }, select: { id: true } });
        if (!existe) throw introuvable("Acompte");
        return false;
      }
      await tx.depositPaymentEvent.create({
        data: { acompteId, type: "instructions_envoyees" },
      });
      return true;
    });
  }

  /** Seule une réception confirmée fait bouger le cumul reçu. */
  private incrementRecu(evenement: EntreeEvenementAcompte): { montantRecu?: { increment: number } } {
    return evenement.type === "reception_confirmee" && evenement.montant !== undefined
      ? { montantRecu: { increment: evenement.montant } }
      : {};
  }

  private donneesEvenement(acompteId: string, evenement: EntreeEvenementAcompte) {
    return {
      acompteId,
      type: evenement.type,
      montant: evenement.montant ?? null,
      acteurId: evenement.acteurId ?? null,
      referenceTransaction: evenement.referenceTransaction ?? null,
      commentaire: evenement.commentaire ?? null,
    };
  }

  /**
   * Refuse « payé » si la demande n'est plus vivante.
   *
   * `FOR SHARE` tient la ligne de la demande jusqu'à la fin de la transaction :
   * une expiration qui arriverait pendant ce temps attend, et ne se glisse pas
   * entre la lecture et l'écriture. Si elle était en cours, c'est son résultat
   * qu'on lit.
   */
  private async exigerDemandePayable(tx: Transaction, acompteId: string): Promise<void> {
    const lignes = await tx.$queryRaw<{ statut: string }[]>`
      SELECT d."statut"::text AS statut
      FROM "deposit_payments" p
      JOIN "demands" d ON d."id" = p."demandeId"
      WHERE p."id" = ${acompteId}
      FOR SHARE OF d`;
    if (lignes.length === 0) throw introuvable("Acompte");

    const statut = lignes[0].statut;
    if (!(STATUTS_DEMANDE_PAYABLES as readonly string[]).includes(statut)) {
      throw new ErreurMetier(
        "ACOMPTE_DEMANDE_CLOSE",
        `La demande est « ${statut} » : l'acompte ne peut plus être déclaré payé, seulement remboursé.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Lève toujours : introuvable, ou statut changé entre-temps. */
  private async expliquerEchec(tx: Transaction, acompteId: string): Promise<never> {
    const actuel = await tx.depositPayment.findUnique({
      where: { id: acompteId },
      select: { statut: true },
    });
    if (!actuel) throw introuvable("Acompte");
    throw new ErreurMetier(
      "ACOMPTE_STATUT_CONCURRENT",
      `Le statut de l'acompte est désormais « ${actuel.statut} » : rien n'a été modifié.`,
      HttpStatus.CONFLICT,
    );
  }

  /**
   * Le statut doit dire la vérité sur les montants, sans quoi la transaction
   * est annulée : `paye` sans le compte, ou `partiel` sans rien ou avec tout,
   * seraient des mensonges qu'un e-mail recopierait ensuite.
   */
  private verifierCoherence(ligne: DepositPayment): void {
    const { statut, montantRecu, montantAttendu } = ligne;
    if (statut === "paye" && montantRecu < montantAttendu) {
      throw evenementInvalide(
        `Payé exige ${montantAttendu} FCFA reçus ; ${montantRecu} FCFA seulement sont constatés.`,
      );
    }
    if (statut === "partiel" && (montantRecu <= 0 || montantRecu >= montantAttendu)) {
      throw evenementInvalide(
        `Partiel exige un montant reçu entre 1 et ${montantAttendu - 1} FCFA ; ${montantRecu} FCFA constatés.`,
      );
    }
  }
}
