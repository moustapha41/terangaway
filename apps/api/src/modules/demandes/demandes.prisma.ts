import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Prisma, type Demand } from "@prisma/client";
import { totalSejour, type Demande, type StatutDemande } from "@teranga/contracts";

import { randomBytes } from "node:crypto";
import { PrismaService } from "../../base-de-donnees/prisma.service";
import { DEPOT_LOGEMENTS, DEPOT_VEHICULES } from "../../commun/depots/depot";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import {
  genererJetonPartenaire,
  hacherJetonDirect,
} from "../../commun/securite/hachage";
import {
  estIdentiteDemo,
  TELEPHONE_VISITEUR_DEMO,
  VISITEUR_DEMO,
} from "../../commun/securite/identites-demo";
import { config } from "../../config/configuration";
import type { DepotLogements } from "../offres/logements/logements.depot";
import type { DepotVehicules } from "../offres/vehicules/vehicules.depot";
import type {
  DepotDemandes,
  EntreeCreationLogement,
  EntreeCreationService,
  EntreeCreationVehicule,
  DemandeARelancer,
  JetonReponse,
} from "./demandes.depot";
import { transitionConcurrente } from "./demandes.depot";
import { coordonneesAEffacer, coordonneesDivulguables } from "./coordonnees";

/**
 * La vérification des coordonnées n'a pas encore de colonne en base
 * (`coordonneesVerifieesLe`, migration en attente de validation). Tant que
 * c'est le cas, rien n'est vérifié : la lecture se ferme. À remplacer par
 * `row.coordonneesVerifieesLe !== null` le jour de la migration.
 */
const VERIFICATION_PERSISTEE = false;
import { acompteNonPaye } from "../acomptes/erreurs";
import {
  autreDemandeConfirmeeEnConflit,
  genreAGarde,
  offreDejaConfirmee,
  verrouillerOffre,
} from "./occupation";
import { expireLePour, type GenreService } from "./machine-a-etats/delais";

@Injectable()
export class DepotDemandesPrisma implements DepotDemandes {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DEPOT_LOGEMENTS) private readonly depotLogements: DepotLogements,
    @Inject(DEPOT_VEHICULES) private readonly depotVehicules: DepotVehicules,
  ) {}

  async listerPourVisiteur(visiteurId: string): Promise<Demande[]> {
    const rows = await this.prisma.demand.findMany({
      where: { visiteurId },
      orderBy: { creeLe: "desc" },
    });
    return rows.map(demandToDemande);
  }

  async parId(id: string): Promise<Demande | null> {
    const row = await this.prisma.demand.findUnique({
      where: { id },
    });
    return row ? demandToDemande(row) : null;
  }

  /**
   * Contrôle rapide, **sans verrou** : refuse tôt, avec le bon message, une
   * confirmation qui ne pourra pas aboutir. Il ne garantit rien — seule la garde
   * de `enregistrer`, sous verrou, fait foi.
   */
  async exigerOffreLibre(demandeId: string): Promise<void> {
    const demande = await this.prisma.demand.findUnique({
      where: { id: demandeId },
      select: { id: true, offreId: true, genre: true, dateDebut: true, dateFin: true },
    });
    if (demande && (await autreDemandeConfirmeeEnConflit(this.prisma, demande))) throw offreDejaConfirmee();
  }

  async genreDe(demandeId: string): Promise<GenreService | undefined> {
    const ligne = await this.prisma.demand.findUnique({ where: { id: demandeId }, select: { genre: true } });
    return ligne?.genre;
  }

  async creerLogement(entree: EntreeCreationLogement): Promise<Demande> {
    const logement = await this.depotLogements.parId(entree.logementId);
    if (!logement) throw introuvable("Logement");

    const jour = 24 * 60 * 60 * 1000;
    const nuits = Math.max(
      1,
      Math.round(
        (new Date(entree.fin).getTime() - new Date(entree.debut).getTime()) / jour,
      ),
    );
    if (Number.isNaN(nuits) || new Date(entree.fin) <= new Date(entree.debut)) {
      throw new ErreurMetier("DATES_INVALIDES", "Les dates de séjour sont invalides.");
    }
    if (entree.personnes > logement.capacite) {
      throw new ErreurMetier(
        "CAPACITE_DEPASSEE",
        "Ce logement ne peut pas accueillir autant de personnes.",
      );
    }

    const fraisFixes = logement.fraisFixes ?? [];
    const total =
      totalSejour(logement, nuits, fraisFixes);
    const maintenant = new Date().toISOString();

    // Assure l'existence du compte demandeur
    const compteVisiteur = await this.assurerCompteVisiteur(entree.visiteurId);

    // Assure l'existence du compte prestataire s'il est connu
    let prestataireId: string | null = null;
    if (logement.partenaire?.id) {
      const comptePrestataire = await this.prisma.account.upsert({
        where: { id: logement.partenaire.id },
        update: {},
        create: {
          id: logement.partenaire.id,
          telephone: "771234567",
          nom: logement.partenaire.nomAffiche ?? "Prestataire Démo",
          role: "PRESTATAIRE",
          typeCompte: "LES_DEUX",
          estVerifie: true,
          verifieLe: new Date(),
        },
      });
      prestataireId = comptePrestataire.id;
    }

    const reference = await this.genererReferenceUnique();

    const created = await this.prisma.demand.create({
      data: {
        id: `d-${Date.now()}-${randomBytes(4).toString("hex")}`,
        reference,
        visiteurId: compteVisiteur.id,
        prestataireId,
        genre: "logement",
        statut: "envoyee",
        offreId: logement.id,
        offreTitre: logement.titre,
        offreVignette: logement.photos[0]?.url,
        dateDebut: entree.debut,
        dateFin: entree.fin,
        personnes: entree.personnes,
        heureArrivee: entree.heureArrivee,
        message: entree.message,
        prixUnitaire: logement.prixParNuit,
        nuits,
        fraisFixes: fraisFixes as any,
        prixTotal: total,
        frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
        expireLe: new Date(expireLePour("logement")),
      },
    });

    // Le jeton de réponse n'est plus fabriqué ici : il l'était, puis jeté —
    // seule l'empreinte restait, et la valeur en clair n'allait nulle part.
    // Il s'émet maintenant par `emettreJetonReponse`, au moment où l'on sait
    // à qui l'envoyer.

    return demandToDemande(created);
  }

  async aExpirer(maintenant: Date, limite: number): Promise<string[]> {
    const rows = await this.prisma.demand.findMany({
      where: {
        statut: { in: ["envoyee", "acceptee"] },
        expireLe: { not: null, lt: maintenant },
      },
      orderBy: { expireLe: "asc" },
      take: limite,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async aRelancer(seuils: Record<string, Date>, limite: number): Promise<DemandeARelancer[]> {
    const parGenre = Object.entries(seuils).map(([genre, avant]) => ({
      genre: genre as Demand["genre"],
      creeLe: { lte: avant },
    }));
    if (parGenre.length === 0) return [];

    const rows = await this.prisma.demand.findMany({
      where: { statut: "envoyee", relanceeLe: null, OR: parGenre },
      orderBy: { creeLe: "asc" },
      take: limite,
      select: { id: true, reference: true, genre: true, offreTitre: true, creeLe: true, expireLe: true },
    });

    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      genre: row.genre,
      titre: row.offreTitre,
      creeLe: row.creeLe.toISOString(),
      expireLe: row.expireLe?.toISOString(),
    }));
  }

  async marquerRelancees(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.demand.updateMany({
      where: { id: { in: [...ids] } },
      data: { relanceeLe: new Date() },
    });
  }

  async emettreJetonReponse(demandeId: string): Promise<JetonReponse | null> {
    const demande = await this.prisma.demand.findUnique({
      where: { id: demandeId },
      select: { prestataireId: true, prestataire: { select: { id: true, nom: true, email: true } } },
    });
    if (!demande?.prestataireId || !demande.prestataire) return null;

    const jeton = genererJetonPartenaire();
    // Deux heures, comme le délai de réponse : un jeton qui survivrait à
    // l'échéance laisserait accepter une demande déjà expirée.
    const expireLe = new Date(Date.now() + 120 * 60_000);

    await this.prisma.providerResponseToken.create({
      data: {
        demandeId,
        prestataireId: demande.prestataireId,
        tokenHash: hacherJetonDirect(jeton),
        expiresAt: expireLe,
      },
    });

    return {
      jeton,
      expireLe: expireLe.toISOString(),
      prestataire: {
        id: demande.prestataire.id,
        nom: demande.prestataire.nom ?? undefined,
        email: demande.prestataire.email ?? undefined,
      },
    };
  }

  async creerVehicule(entree: EntreeCreationVehicule): Promise<Demande> {
    const vehicule = await this.depotVehicules.parId(entree.vehiculeId);
    if (!vehicule) throw introuvable("Vehicule");

    const genre =
      entree.prestation === "journee"
        ? "location"
        : entree.prestation === "taxi"
          ? "taxi"
          : "trajet";

    const total =
      entree.prestation === "journee"
        ? (vehicule.prixParJour ?? vehicule.prixParTrajet ?? 0)
        : (vehicule.prixParTrajet ?? vehicule.prixParJour ?? 0);

    const maintenant = new Date().toISOString();
    const compteVisiteur = await this.assurerCompteVisiteur(entree.visiteurId);

    const reference = await this.genererReferenceUnique();

    const created = await this.prisma.demand.create({
      data: {
        id: `d-${Date.now()}-${randomBytes(4).toString("hex")}`,
        reference,
        visiteurId: compteVisiteur.id,
        genre,
        statut: "envoyee",
        offreId: vehicule.id,
        offreTitre: `${vehicule.marque} ${vehicule.modele}`,
        offreVignette: vehicule.photos[0]?.url,
        dateDebut: entree.quand,
        dateFin: entree.quand,
        personnes: entree.passagers,
        prestationTransport: entree.prestation,
        lieuDepart: entree.depart,
        lieuArrivee: entree.arrivee,
        bagages: entree.bagages,
        vol: entree.vol,
        message: entree.message,
        prixUnitaire: total,
        nuits: 1,
        fraisFixes: [],
        prixTotal: total,
        frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
        expireLe: new Date(expireLePour(genre)),
      },
    });

    return demandToDemande(created);
  }

  /**
   * Une demande de service : aucune offre derrière, donc aucun prix.
   *
   * `details` est écrit tel quel dans la colonne JSON : c'est la seule chose
   * que l'équipe aura pour chercher un prestataire, et la réécrire ici lui
   * ferait perdre ce que le visiteur a précisé.
   */
  async creerService(entree: EntreeCreationService): Promise<Demande> {
    const maintenant = new Date().toISOString();
    const compteVisiteur = await this.assurerCompteVisiteur(entree.visiteurId);
    const reference = await this.genererReferenceUnique();

    const created = await this.prisma.demand.create({
      data: {
        id: `d-${Date.now()}-${randomBytes(4).toString("hex")}`,
        reference,
        visiteurId: compteVisiteur.id,
        genre: "service",
        statut: "envoyee",
        offreTitre: entree.service,
        service: entree.service,
        details: entree.details as any,
        // Une date utile au tri : celle que le visiteur a demandée s'il en a
        // donné une, sinon rien. Les services n'ont pas tous une date.
        dateDebut: entree.details.date ?? null,
        dateFin: entree.details.date ?? null,
        personnes: Number(entree.details.personnes ?? entree.details.lignes ?? 1) || 1,
        message: entree.message,
        prixUnitaire: 0,
        nuits: null,
        fraisFixes: [],
        prixTotal: 0,
        frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
      },
    });

    return demandToDemande(created);
  }

  async enregistrer(demande: Demande, statutLu: StatutDemande): Promise<Demande> {
    // Un seul `UPDATE … WHERE id = ? AND statut = ?` : la condition et
    // l'écriture sont le même ordre SQL, il n'y a pas de fenêtre entre les
    // deux. Relire puis écrire sans condition ne fermerait pas la course.
    //
    // La relecture partage la transaction : la ligne reste verrouillée par
    // notre écriture jusqu'au commit, on rend donc exactement ce qu'on a écrit,
    // pas une transition arrivée juste après.
    return this.prisma.$transaction(async (tx) => {
      // Confirmer exige un acompte payé et vérifié — **sous verrou**. Le service
      // a déjà refusé en amont, mais entre cette lecture et cette écriture, une
      // décision de remboursement pouvait passer. `FOR SHARE` tient le dossier
      // jusqu'au commit : une décision (`FOR UPDATE`) attend notre fin, ou est
      // passée avant et nous la voyons. Même verrou que les réceptions, aucun
      // mécanisme de plus. Sans dossier, rien n'a été demandé : rien n'est exigé.
      if (demande.statut === "confirmee") {
        // L'offre d'abord : verrou par offre, puis recherche d'une autre demande
        // confirmée aux dates qui se recouvrent, puis écriture — dans cette même
        // transaction. Deux confirmations de la même offre s'ordonnent ici ; la
        // seconde voit la première et refuse. Indépendant de l'acompte et de
        // `ACOMPTE_ACTIF` : une offre ne se double-réserve pas, payée ou non.
        const occupante = await tx.demand.findUnique({
          where: { id: demande.id },
          select: { id: true, offreId: true, genre: true, dateDebut: true, dateFin: true },
        });
        if (occupante?.offreId && genreAGarde(occupante.genre)) {
          await verrouillerOffre(tx, occupante.offreId);
          if (await autreDemandeConfirmeeEnConflit(tx, occupante)) throw offreDejaConfirmee();
        }

        const dossiers = await tx.$queryRaw<{ statut: string }[]>`
          SELECT "statut"::text AS statut
          FROM "deposit_payments"
          WHERE "demandeId" = ${demande.id}
          FOR SHARE`;
        if (dossiers.length > 0 && dossiers[0].statut !== "paye") throw acompteNonPaye();
      }

      const { count } = await tx.demand.updateMany({
        where: { id: demande.id, statut: statutLu as Demand["statut"] },
        data: {
          statut: demande.statut as any,
          expireLe: demande.expireLe ? new Date(demande.expireLe) : null,
          motifRefus: demande.motifRefus ?? null,
          // Une transition n'écrit les coordonnées que pour les **effacer** —
          // `DbNull`, parce qu'une colonne JSON n'accepte pas `null` tel quel,
          // et que `undefined` laisserait la valeur en place. Sinon, la colonne
          // n'est pas touchée : l'objet reçu a été lu à travers le filtre de
          // divulgation, et l'écrire effacerait des coordonnées saisies par
          // l'équipe avant la confirmation.
          ...(coordonneesAEffacer(demande.statut) ? { coordonnees: Prisma.DbNull } : {}),
          frise: demande.frise as any,
        },
      });

      const ligne = await tx.demand.findUnique({ where: { id: demande.id } });
      if (!ligne) throw introuvable("Demande");
      if (count === 0) throw transitionConcurrente(demande.id, statutLu, ligne.statut as StatutDemande);
      return demandToDemande(ligne);
    });
  }

  async visiteurDe(demandeId: string): Promise<string | null> {
    const demand = await this.prisma.demand.findUnique({
      where: { id: demandeId },
      select: { visiteurId: true },
    });
    return demand ? demand.visiteurId : null;
  }

  private async assurerCompteVisiteur(visiteurId: string) {
    const existant = await this.prisma.account.findUnique({
      where: { id: visiteurId },
    });
    if (existant) return existant;

    if (estIdentiteDemo(visiteurId)) {
      // Garde-fou local : rattacher une réservation au compte de démonstration
      // la rend visible par tous ceux qui résolvent vers cette identité. En
      // amont, `exigerVisiteur` ne renvoie plus jamais cette valeur hors mode
      // démo ; on le vérifie ici aussi, au plus près de l'écriture.
      if (!config.autoriserComptesDemo) {
        throw new ErreurMetier(
          "NON_AUTHENTIFIE",
          "Session invalide ou expirée.",
          HttpStatus.UNAUTHORIZED,
        );
      }

      const demoExistant = await this.prisma.account.findFirst({
        where: { OR: [{ id: VISITEUR_DEMO }, { telephone: TELEPHONE_VISITEUR_DEMO }] },
      });
      if (demoExistant) return demoExistant;

      return this.prisma.account.create({
        data: {
          id: VISITEUR_DEMO,
          telephone: TELEPHONE_VISITEUR_DEMO,
          nom: "Visiteur Démo",
          role: "VISITEUR",
          typeCompte: "VISITEUR",
          estVerifie: true,
          verifieLe: new Date(),
        },
      });
    }

    return this.prisma.account.create({
      data: {
        id: visiteurId,
        nom: "Visiteur",
        role: "VISITEUR",
        typeCompte: "VISITEUR",
        estVerifie: true,
        verifieLe: new Date(),
      },
    });
  }

  private async genererReferenceUnique(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = Math.floor(100000 + Math.random() * 900000);
      const reference = `TW-${code}`;
      const dejaPris = await this.prisma.demand.findUnique({
        where: { reference },
      });
      if (!dejaPris) return reference;
    }
    return `TW-${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Une ligne de la table vers le contrat visiteur.
 *
 * Exportée pour le backoffice, qui en enrichit le résultat plutôt que d'écrire
 * une seconde traduction : deux conversions divergent toujours, et c'est
 * l'équipe qui verrait la différence sans comprendre pourquoi.
 */
export function demandToDemande(row: Demand): Demande {
  const genre =
    row.genre === "logement"
      ? "logement"
      : row.genre === "service"
        ? "service"
        : "vehicule";

  let offre: Demande["offre"];
  if (genre === "logement") {
    offre = {
      genre: "logement",
      logementId: row.offreId ?? "",
      titre: row.offreTitre,
      vignette: row.offreVignette ?? "",
    };
  } else if (genre === "service") {
    offre = {
      genre: "service",
      service: (row.service as any) ?? (row.offreId as any) ?? "assistance",
      titre: row.offreTitre,
      vignette: row.offreVignette ?? undefined,
      details:
        row.details && typeof row.details === "object" && !Array.isArray(row.details)
          ? (row.details as Record<string, string>)
          : {},
    };
  } else {
    offre = {
      genre: "vehicule",
      vehiculeId: row.offreId ?? "",
      titre: row.offreTitre,
      vignette: row.offreVignette ?? "",
    };
  }

  const fraisFixes = Array.isArray(row.fraisFixes)
    ? (row.fraisFixes as unknown as { libelle: string; montant: number }[])
    : [];
  const frise = Array.isArray(row.frise) ? (row.frise as any) : [];

  return {
    id: row.id,
    reference: row.reference,
    statut: row.statut as any,
    offre,
    dates: {
      debut: row.dateDebut ?? "",
      fin: row.dateFin ?? "",
    },
    personnes: row.personnes,
    heureArrivee: row.heureArrivee ?? undefined,
    message: row.message ?? undefined,
    prix: {
      prixParNuit: row.prixUnitaire,
      nuits: row.nuits ?? 1,
      fraisFixes,
      total: row.prixTotal,
    },
    frise,
    expireLe: row.expireLe ? row.expireLe.toISOString() : undefined,
    motifRefus: (row.motifRefus as any) ?? undefined,
    // Filtré ici, à la source de toutes les lectures, et pas seulement à
    // l'écran : il faut un statut qui l'autorise **et** une vérification
    // enregistrée par une seconde personne. La colonne de vérification
    // attend sa migration : d'ici là, aucune coordonnée n'est réputée
    // vérifiée, et aucune ne sort — historiques comprises.
    coordonnees: coordonneesDivulguables(row.statut as StatutDemande, VERIFICATION_PERSISTEE)
      ? ((row.coordonnees as any) ?? undefined)
      : undefined,
  };
}
