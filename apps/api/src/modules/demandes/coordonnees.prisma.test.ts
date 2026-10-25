import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Demande, StatutDemande } from "@teranga/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotAdministrationPrisma } from "../administration/administration.prisma";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { STATUTS_AVEC_COORDONNEES } from "./coordonnees";
import type { DepotDemandes } from "./demandes.depot";
import { DepotDemandesFixtures } from "./demandes.fixtures";
import { DepotDemandesPrisma } from "./demandes.prisma";
import { ServiceDemandes } from "./demandes.service";
import { fenetreUnique, reserverFenetres } from "./fenetres-uniques.test-utils";

async function codeDe(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return (erreur.getResponse() as { code: string }).code;
    throw erreur;
  }
  throw new Error("La promesse aurait dû échouer.");
}

/**
 * Les coordonnées personnelles — adresse exacte, téléphone — de bout en bout.
 *
 * Trois règles :
 *   aucune transition n'en fabrique — elles sont saisies par l'équipe ;
 *   une lecture ne les rend qu'aux statuts « confirmee » et « terminee »,
 *   au visiteur comme à l'administration ;
 *   une demande annulée, expirée ou refusée les perd en base.
 *
 * La saisie par l'équipe n'existe pas encore : chaque test l'imite en écrivant
 * des valeurs de test sur **sa propre** demande, et sur rien d'autre.
 */
describe("Coordonnées personnelles — divulgation et effacement", () => {
  let prisma: PrismaService;
  let depot: DepotDemandesPrisma;
  let administration: DepotAdministrationPrisma;
  let service: ServiceDemandes;

  const SAISIES = {
    adresseExacte: "ADRESSE-DE-TEST",
    telephone: "TELEPHONE-DE-TEST",
    consignesArrivee: "CONSIGNES-DE-TEST",
  };

  const logement = async () => {
    const visiteurId = `visiteur-coordonnees-${randomBytes(4).toString("hex")}`;
    const demande = await depot.creerLogement({
      logementId: "l-001",
      ...fenetreUnique(4),
      personnes: 2,
      visiteurId,
    });
    return { demande, visiteurId };
  };

  const colonne = async (id: string) =>
    (await prisma.demand.findUniqueOrThrow({ where: { id }, select: { coordonnees: true } })).coordonnees;

  /** Ce que fera le futur backoffice : l'équipe saisit les coordonnées. */
  const saisir = (id: string) => prisma.demand.update({ where: { id }, data: { coordonnees: SAISIES } });

  const RIEN = { visiteur: undefined, liste: undefined, administration: undefined };

  /** Ce que voient le visiteur et l'équipe, par leurs chemins de lecture. */
  const lectures = async (id: string, visiteurId: string) => ({
    visiteur: (await service.obtenirPourVisiteur(id, visiteurId)).coordonnees,
    liste: (await service.listerPourVisiteur(visiteurId)).find((d) => d.id === id)!.coordonnees,
    administration: (await administration.parId(id))!.coordonnees,
  });

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    await reserverFenetres(prisma);
    depot = new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures());
    administration = new DepotAdministrationPrisma(prisma);
    service = new ServiceDemandes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("aucune coordonnée fabriquée", () => {
    it("la confirmation réussit sans coordonnées, et n'en invente pas", async () => {
      const { demande, visiteurId } = await logement();
      await service.accepterParPartenaire(demande.id);

      const confirmee = await service.confirmer(demande.id);
      expect(confirmee.statut).toBe("confirmee");
      expect(confirmee.coordonnees).toBeUndefined();
      expect(await colonne(demande.id)).toBeNull();
      expect(await lectures(demande.id, visiteurId)).toEqual({
        visiteur: undefined,
        liste: undefined,
        administration: undefined,
      });
    });

    it("le code des transitions ne porte plus aucune des anciennes valeurs fixes", () => {
      const source = readFileSync(join(__dirname, "demandes.service.ts"), "utf8");
      for (const fictive of ["Corniche Ouest", "+221 77 123 45 67", "+221 77 987 65 43", "DK-2026-AB", "AIBD"]) {
        expect(source, fictive).not.toContain(fictive);
      }
      expect(source).not.toMatch(/adresseExacte\s*:/);
      expect(source).not.toMatch(/immatriculation\s*:/);
    });
  });

  describe("divulgation à la lecture", () => {
    it("saisies mais non vérifiées : jamais rendues, ni à « acceptee » ni à « confirmee », et jamais réécrites", async () => {
      // La base ne sait pas encore enregistrer une vérification (migration en
      // attente) : aucune coordonnée n'y est donc vérifiée, et aucune ne sort.
      const { demande, visiteurId } = await logement();
      await service.accepterParPartenaire(demande.id);
      await saisir(demande.id);
      expect(await lectures(demande.id, visiteurId)).toEqual(RIEN);

      const confirmee = await service.confirmer(demande.id);
      expect(confirmee.coordonnees).toBeUndefined();
      expect(await lectures(demande.id, visiteurId)).toEqual(RIEN);
      expect(await colonne(demande.id)).toEqual(SAISIES);
    });

    it("terminée : conservées en base, toujours pas rendues sans vérification", async () => {
      const { demande, visiteurId } = await logement();
      await service.accepterParPartenaire(demande.id);
      await saisir(demande.id);
      await service.confirmer(demande.id);

      const terminee = await service.transitionner(demande.id, "terminee", "systeme");
      expect(terminee.coordonnees).toBeUndefined();
      expect(await colonne(demande.id)).toEqual(SAISIES);
      expect(await lectures(demande.id, visiteurId)).toEqual(RIEN);
    });

    for (const statut of ["envoyee", "acceptee", "annulee", "expiree", "refusee"] as const) {
      it(`« ${statut} » avec des coordonnées en base : jamais rendues, ni au visiteur ni à l'équipe`, async () => {
        // Une ligne ancienne — d'avant l'effacement réel — ou une saisie
        // anticipée : la lecture doit tenir seule, sans compter sur la base.
        const { demande, visiteurId } = await logement();
        await prisma.demand.update({
          where: { id: demande.id },
          data: { statut, coordonnees: SAISIES },
        });

        expect(await lectures(demande.id, visiteurId)).toEqual({
          visiteur: undefined,
          liste: undefined,
          administration: undefined,
        });
        expect(await colonne(demande.id)).toEqual(SAISIES);
      });
    }

    it("couvre exactement « confirmee » et « terminee »", () => {
      expect([...STATUTS_AVEC_COORDONNEES].sort()).toEqual(["confirmee", "terminee"]);
    });
  });

  describe("effacement persisté", () => {
    const confirmeeAvecCoordonnees = async () => {
      const { demande, visiteurId } = await logement();
      await service.accepterParPartenaire(demande.id);
      await saisir(demande.id);
      await service.confirmer(demande.id);
      return { demande, visiteurId };
    };

    it("annulée par le visiteur après confirmation : retirées en base et de toutes les lectures", async () => {
      const { demande, visiteurId } = await confirmeeAvecCoordonnees();

      const annulee = await service.annulerPourVisiteur(demande.id, visiteurId);
      expect(annulee.coordonnees).toBeUndefined();
      expect(await colonne(demande.id)).toBeNull();
      expect(await lectures(demande.id, visiteurId)).toEqual({
        visiteur: undefined,
        liste: undefined,
        administration: undefined,
      });
    });

    it("annulée par l'équipe après confirmation : même effacement", async () => {
      const { demande } = await confirmeeAvecCoordonnees();
      await service.transitionner(demande.id, "annulee", "equipe");
      expect(await colonne(demande.id)).toBeNull();
    });

    it("expirée : des coordonnées saisies sont retirées", async () => {
      const { demande } = await logement();
      await service.accepterParPartenaire(demande.id);
      await saisir(demande.id);

      await service.transitionner(demande.id, "expiree", "systeme");
      expect(await colonne(demande.id)).toBeNull();
    });

    it("refusée : des coordonnées saisies sont retirées", async () => {
      const { demande } = await logement();
      await saisir(demande.id);

      await service.refuserParPartenaire(demande.id, "plus-disponible");
      expect(await colonne(demande.id)).toBeNull();
    });

    it("une annulation devancée par une autre transition n'efface rien : la concurrence tient toujours", async () => {
      const { demande } = await confirmeeAvecCoordonnees();
      const confirmee = (await depot.parId(demande.id))!;

      // Le visiteur lit « confirmee »… le système termine la demande… le
      // visiteur annule sur sa lecture périmée.
      await service.transitionner(demande.id, "terminee", "systeme");
      const lectureFigee = new Proxy(depot, {
        get(cible, nom, recepteur) {
          if (nom === "parId") return async () => structuredClone(confirmee) as Demande;
          const valeur = Reflect.get(cible, nom, recepteur);
          return typeof valeur === "function" ? valeur.bind(cible) : valeur;
        },
      }) as DepotDemandes;

      expect(await codeDe(new ServiceDemandes(lectureFigee).annuler(demande.id))).toBe("TRANSITION_CONCURRENTE");
      expect(await colonne(demande.id)).toEqual(SAISIES);
    });
  });

  describe("le dépôt en mémoire tient le même contrat", () => {
    const memoire = () => {
      const depotMemoire = new DepotDemandesFixtures();
      return { depotMemoire, service: new ServiceDemandes(depotMemoire) };
    };

    it("confirme sans fabriquer de coordonnées", async () => {
      const { service: enMemoire } = memoire();
      const demande = await enMemoire.creerLogement({
        logementId: "l-001",
        ...fenetreUnique(4),
        personnes: 2,
        visiteurId: "visiteur-memoire",
      });
      await enMemoire.accepterParPartenaire(demande.id);
      expect((await enMemoire.confirmer(demande.id)).coordonnees).toBeUndefined();
    });

    it("une démonstration confirmée mais non vérifiée ne rend rien", async () => {
      const { depotMemoire } = memoire();
      const confirmees = (await depotMemoire.listerPourVisiteur("visiteur-demo")).filter(
        (d) => d.statut === "confirmee",
      );
      expect(confirmees.length).toBeGreaterThan(0);
      for (const demande of confirmees) expect(demande.coordonnees, demande.id).toBeUndefined();
    });

    it("ne rend jamais de coordonnées hors des statuts qui les autorisent", async () => {
      const { depotMemoire } = memoire();
      for (const demande of await depotMemoire.listerPourVisiteur("visiteur-demo")) {
        if (!STATUTS_AVEC_COORDONNEES.includes(demande.statut as StatutDemande)) {
          expect(demande.coordonnees, demande.id).toBeUndefined();
        }
      }
    });
  });
});
