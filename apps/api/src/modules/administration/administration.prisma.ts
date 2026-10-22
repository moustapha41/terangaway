import { Inject, Injectable } from "@nestjs/common";
import type { Account, Demand, Prisma } from "@prisma/client";
import type {
  ContactAdmin,
  DemandeAdmin,
  FiltresDemandesAdmin,
  GenreDemande,
  PageDemandesAdmin,
  StatutDemande,
  TableauDeBordAdmin,
} from "@teranga/contracts";
import { GENRES_DEMANDE, STATUTS_DEMANDE } from "@teranga/contracts";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { introuvable } from "../../commun/erreurs";
import { demandToDemande } from "../demandes/demandes.prisma";
import type { AnnotationAdmin, DepotAdministration } from "./administration.depot";

/** Au-delà, une page ne se lit plus : elle se télécharge. */
const PAR_PAGE_MAXIMUM = 100;
const PAR_PAGE_DEFAUT = 25;
/** Garde-fou de l'export : au-delà, c'est une extraction de base, pas un CSV. */
const EXPORT_MAXIMUM = 5000;

type LigneAvecComptes = Demand & {
  visiteur: Account;
  prestataire: Account | null;
};

const AVEC_COMPTES = { visiteur: true, prestataire: true } as const;

@Injectable()
export class DepotAdministrationPrisma implements DepotAdministration {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async lister(filtres: FiltresDemandesAdmin): Promise<PageDemandesAdmin> {
    const where = conditions(filtres);
    const parPage = Math.min(Math.max(filtres.parPage ?? PAR_PAGE_DEFAUT, 1), PAR_PAGE_MAXIMUM);
    const page = Math.max(filtres.page ?? 1, 1);

    const [total, rows] = await Promise.all([
      this.prisma.demand.count({ where }),
      this.prisma.demand.findMany({
        where,
        include: AVEC_COMPTES,
        orderBy: { creeLe: "desc" },
        skip: (page - 1) * parPage,
        take: parPage,
      }),
    ]);

    return { demandes: rows.map(rangerDemandeAdmin), total, page, parPage };
  }

  async parId(id: string): Promise<DemandeAdmin | null> {
    const row = await this.prisma.demand.findUnique({ where: { id }, include: AVEC_COMPTES });
    return row ? rangerDemandeAdmin(row) : null;
  }

  async annoter(id: string, annotation: AnnotationAdmin): Promise<DemandeAdmin> {
    const existe = await this.prisma.demand.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw introuvable("Demande");

    // Un champ absent n'est pas un champ vidé : on ne touche qu'à ce que
    // l'équipe a réellement modifié. `null` efface, `undefined` laisse.
    const data: Prisma.DemandUpdateInput = {};
    if (annotation.noteInterne !== undefined) {
      data.noteInterne = annotation.noteInterne.trim() || null;
    }
    if (annotation.prixPropose !== undefined) {
      data.prixPropose = annotation.prixPropose;
    }
    if (annotation.prestataireId !== undefined) {
      data.prestataire = annotation.prestataireId
        ? { connect: { id: annotation.prestataireId } }
        : { disconnect: true };
    }

    const row = await this.prisma.demand.update({
      where: { id },
      data,
      include: AVEC_COMPTES,
    });
    return rangerDemandeAdmin(row);
  }

  async exporter(filtres: FiltresDemandesAdmin): Promise<DemandeAdmin[]> {
    const rows = await this.prisma.demand.findMany({
      where: conditions(filtres),
      include: AVEC_COMPTES,
      orderBy: { creeLe: "desc" },
      take: EXPORT_MAXIMUM,
    });
    return rows.map(rangerDemandeAdmin);
  }

  async listerPrestataires(): Promise<ContactAdmin[]> {
    const rows = await this.prisma.account.findMany({
      where: { role: "PRESTATAIRE" },
      orderBy: [{ nom: "asc" }, { email: "asc" }],
    });
    return rows.map(contact);
  }

  async tableauDeBord(): Promise<TableauDeBordAdmin> {
    const maintenant = new Date();
    const minuit = debutDeJournee(maintenant);

    const [parStatut, parGenre, total, aujourdhui, enRetard] = await Promise.all([
      this.prisma.demand.groupBy({ by: ["statut"], _count: { _all: true } }),
      this.prisma.demand.groupBy({ by: ["genre"], _count: { _all: true } }),
      this.prisma.demand.count(),
      this.prisma.demand.count({ where: { creeLe: { gte: minuit } } }),
      this.prisma.demand.count({
        where: { statut: "envoyee", expireLe: { not: null, lt: maintenant } },
      }),
    ]);

    const statuts = Object.fromEntries(
      STATUTS_DEMANDE.map((statut) => [
        statut,
        parStatut.find((l) => l.statut === statut)?._count._all ?? 0,
      ]),
    ) as Record<StatutDemande, number>;

    const genres = Object.fromEntries(
      GENRES_DEMANDE.map((genre) => [
        genre,
        parGenre.find((l) => l.genre === genre)?._count._all ?? 0,
      ]),
    ) as Record<GenreDemande, number>;

    return {
      aujourdhui,
      aTraiter: statuts.envoyee,
      enRetard,
      parStatut: statuts,
      parGenre: genres,
      total,
    };
  }
}

/**
 * Les filtres de l'écran, traduits en conditions SQL.
 *
 * La recherche porte sur ce qu'on a sous les yeux quand on cherche : une
 * référence lue au téléphone, le titre d'une offre, le nom ou l'adresse de la
 * personne qui appelle. Sans la jointure sur le compte, l'équipe aurait dû
 * retrouver la demande à l'œil dans la liste.
 */
function conditions(filtres: FiltresDemandesAdmin): Prisma.DemandWhereInput {
  const where: Prisma.DemandWhereInput = {};

  if (filtres.statut) where.statut = filtres.statut;
  if (filtres.genre) where.genre = filtres.genre;
  if (filtres.service) where.service = filtres.service;

  const du = filtres.du ? new Date(`${filtres.du}T00:00:00`) : undefined;
  // `au` est inclusif : on compare à la fin de la journée, pas à son début.
  const au = filtres.au ? new Date(`${filtres.au}T23:59:59.999`) : undefined;
  if (du || au) where.creeLe = { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) };

  const recherche = filtres.recherche?.trim();
  if (recherche) {
    where.OR = [
      { reference: { contains: recherche, mode: "insensitive" } },
      { offreTitre: { contains: recherche, mode: "insensitive" } },
      { visiteur: { nom: { contains: recherche, mode: "insensitive" } } },
      { visiteur: { email: { contains: recherche, mode: "insensitive" } } },
      { visiteur: { telephone: { contains: recherche, mode: "insensitive" } } },
    ];
  }

  return where;
}

function rangerDemandeAdmin(row: LigneAvecComptes): DemandeAdmin {
  const base = demandToDemande(row);
  const estTransport = row.genre === "trajet" || row.genre === "location" || row.genre === "taxi";

  return {
    ...base,
    // Jamais de coordonnées dans la vue de traitement, ni donc dans la liste ou
    // l'export : elles ne se lisent que par leur route dédiée, qui dit aussi
    // qui les a saisies et vérifiées.
    coordonnees: undefined,
    genre: row.genre as GenreDemande,
    creeLe: row.creeLe.toISOString(),
    misAJourLe: row.misAJourLe.toISOString(),
    visiteur: contact(row.visiteur),
    prestataire: row.prestataire ? contact(row.prestataire) : undefined,
    transport: estTransport
      ? {
          prestation: row.prestationTransport ?? undefined,
          depart: row.lieuDepart ?? undefined,
          arrivee: row.lieuArrivee ?? undefined,
          bagages: row.bagages ?? undefined,
          vol: row.vol ?? undefined,
        }
      : undefined,
    service:
      base.offre.genre === "service"
        ? { cle: base.offre.service, details: base.offre.details }
        : undefined,
    noteInterne: row.noteInterne ?? undefined,
    prixPropose: row.prixPropose ?? undefined,
  };
}

function contact(compte: Account): ContactAdmin {
  return {
    id: compte.id,
    nom: compte.nom ?? undefined,
    email: compte.email ?? undefined,
    telephone: compte.telephone ?? undefined,
  };
}

function debutDeJournee(date: Date): Date {
  const copie = new Date(date);
  copie.setHours(0, 0, 0, 0);
  return copie;
}
