import { randomBytes } from "node:crypto";

import type { Demande } from "@teranga/contracts";
import type { Resend } from "resend";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier } from "../../commun/erreurs";
import type { ConfigAcompte } from "../../config/configuration";
import { DepotAcomptesPrisma } from "../acomptes/acomptes.prisma";
import { ServiceAcomptes } from "../acomptes/acomptes.service";
import type { ServiceComptes } from "../comptes/comptes.service";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import type { DepotDemandes } from "./demandes.depot";
import { DepotDemandesFixtures } from "./demandes.fixtures";
import { DepotDemandesPrisma } from "./demandes.prisma";
import { ServiceDemandes } from "./demandes.service";
import { VeilleurDemandes } from "./veilleur.service";

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
 * Les transitions concurrentes d'une demande.
 *
 * Une course réelle se joue en millisecondes et ne se reproduit pas à la
 * demande. On la rend déterministe : un dépôt dont `parId` rend un instantané
 * **figé** fait décider `transitionner` sur un statut que la base a déjà
 * quitté — exactement ce que vit le veilleur quand le visiteur confirme entre
 * sa lecture et son écriture. Tout le reste passe par la vraie base.
 *
 * Chaque test crée ses propres demandes et ne lit qu'elles : ni l'ordre ni le
 * volume des données déjà présentes n'y changent rien.
 */
describe("Transitions concurrentes — écriture conditionnelle au statut lu", () => {
  let prisma: PrismaService;
  let depot: DepotDemandesPrisma;
  let service: ServiceDemandes;

  const suffixe = () => randomBytes(4).toString("hex");

  const logement = async (visiteurId = `visiteur-course-${suffixe()}`) =>
    depot.creerLogement({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-14",
      personnes: 2,
      visiteurId,
    });

  /** Le dépôt réel, sauf `parId` qui rend des instantanés pris plus tôt. */
  const avecLecturesFigees = (...instantanes: Demande[]): DepotDemandes =>
    new Proxy(depot, {
      get(cible, nom, recepteur) {
        if (nom === "parId") {
          return async (id: string) => {
            const fige = instantanes.find((d) => d.id === id);
            return fige ? structuredClone(fige) : cible.parId(id);
          };
        }
        const valeur = Reflect.get(cible, nom, recepteur);
        return typeof valeur === "function" ? valeur.bind(cible) : valeur;
      },
    });

  const enBase = (id: string) => prisma.demand.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures());
    service = new ServiceDemandes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("au dépôt", () => {
    it("écrit la transition quand le statut est celui qu'on a lu", async () => {
      const demande = await logement();
      const acceptee = await service.accepterParPartenaire(demande.id);

      expect(acceptee.statut).toBe("acceptee");
      const ligne = await enBase(demande.id);
      expect(ligne.statut).toBe("acceptee");
      expect(ligne.expireLe).not.toBeNull();
      expect((ligne.frise as unknown[]).length).toBe(2);
    });

    it("rejette une écriture fondée sur un statut devenu obsolète, et ne touche à rien", async () => {
      const demande = await logement();
      const lue = await depot.parId(demande.id);
      await service.accepterParPartenaire(demande.id);
      const avant = await enBase(demande.id);

      expect(
        await codeDe(
          depot.enregistrer(
            { ...lue!, statut: "refusee", motifRefus: "autre", expireLe: undefined },
            "envoyee",
          ),
        ),
      ).toBe("TRANSITION_CONCURRENTE");
      expect(await enBase(demande.id)).toEqual(avant);
    });

    it("signale une demande inconnue comme introuvable, pas comme un conflit", async () => {
      const demande = await logement();
      expect(
        await codeDe(depot.enregistrer({ ...demande, id: "d-inexistante" }, "envoyee")),
      ).toBe("DEMANDE_INTROUVABLE");
    });

    it("tient la même règle dans le dépôt en mémoire", async () => {
      const memoire = new DepotDemandesFixtures();
      const demande = await memoire.creerLogement({
        logementId: "l-001",
        debut: "2026-11-10",
        fin: "2026-11-14",
        personnes: 2,
        visiteurId: "visiteur-memoire",
      });
      await memoire.enregistrer({ ...demande, statut: "acceptee" }, "envoyee");
      expect(
        await codeDe(memoire.enregistrer({ ...demande, statut: "refusee" }, "envoyee")),
      ).toBe("TRANSITION_CONCURRENTE");
      expect((await memoire.parId(demande.id))!.statut).toBe("acceptee");
    });
  });

  describe("la course veilleur / visiteur", () => {
    it("une demande confirmée ne redevient pas expirée, et sa frise ne gagne pas d'étape fantôme", async () => {
      const demande = await logement();
      const acceptee = await service.accepterParPartenaire(demande.id);
      // Coordonnées saisies par l'équipe sur cette demande : l'expiration
      // concurrente ne doit pas les effacer.
      await prisma.demand.update({
        where: { id: demande.id },
        data: { coordonnees: { adresseExacte: "ADRESSE-DE-TEST", telephone: "TELEPHONE-DE-TEST" } },
      });

      // Le veilleur lit « acceptee »… le visiteur confirme… le veilleur écrit.
      await service.confirmer(demande.id);
      const apresConfirmation = await enBase(demande.id);

      const veilleurEnRetard = new ServiceDemandes(avecLecturesFigees(acceptee));
      expect(await codeDe(veilleurEnRetard.transitionner(demande.id, "expiree", "systeme"))).toBe(
        "TRANSITION_CONCURRENTE",
      );

      const ligne = await enBase(demande.id);
      expect(ligne).toEqual(apresConfirmation);
      expect(ligne.statut).toBe("confirmee");
      expect(ligne.coordonnees).not.toBeNull();
      expect((ligne.frise as { statut: string }[]).map((e) => e.statut)).toEqual([
        "envoyee",
        "acceptee",
        "confirmee",
      ]);
    });

    it("une demande expirée ne redevient pas confirmée", async () => {
      const demande = await logement();
      const acceptee = await service.accepterParPartenaire(demande.id);

      // Le visiteur lit « acceptee »… le veilleur expire… le visiteur confirme.
      await service.transitionner(demande.id, "expiree", "systeme");
      const apresExpiration = await enBase(demande.id);

      const visiteurEnRetard = new ServiceDemandes(avecLecturesFigees(acceptee));
      expect(await codeDe(visiteurEnRetard.confirmer(demande.id))).toBe("TRANSITION_CONCURRENTE");

      const ligne = await enBase(demande.id);
      expect(ligne).toEqual(apresExpiration);
      expect(ligne.statut).toBe("expiree");
      expect(ligne.coordonnees).toBeNull();
      expect((ligne.frise as { statut: string }[]).map((e) => e.statut)).toEqual([
        "envoyee",
        "acceptee",
        "expiree",
      ]);
    });

    it("un conflit ne déclenche aucune suite d'acompte", async () => {
      const demande = await logement();
      const acceptee = await service.accepterParPartenaire(demande.id);
      await service.confirmer(demande.id);

      const acomptes = {
        preparer: vi.fn(),
        synchroniserFinDeDemande: vi.fn(),
      } as unknown as ServiceAcomptes;
      const veilleurEnRetard = new ServiceDemandes(avecLecturesFigees(acceptee), acomptes);

      await codeDe(veilleurEnRetard.transitionner(demande.id, "expiree", "systeme"));
      expect(acomptes.synchroniserFinDeDemande).not.toHaveBeenCalled();
      expect(acomptes.preparer).not.toHaveBeenCalled();
    });

    it("un conflit n'annule pas l'acompte d'une demande confirmée", async () => {
      // Le défaut qui a motivé ce correctif, de bout en bout : acompte ouvert
      // pour ce test seulement, Resend simulé, coordonnées de test.
      const ouverte: ConfigAcompte = {
        actif: true,
        pourcentage: 30,
        etatCoordonnees: "defini",
        beneficiaire: { titulaire: "TITULAIRE-DE-TEST", banque: "BANQUE-DE-TEST", iban: "IBANDETESTNEPASUTILISER", bic: "BICDETEST" },
      };
      const send = vi.fn().mockResolvedValue({ data: { id: "em_test" }, error: null });
      const acomptes = new ServiceAcomptes(
        new DepotAcomptesPrisma(prisma),
        new ServiceEmail({ emails: { send } } as unknown as Resend),
        ouverte,
      );
      const visiteurId = `visiteur-course-${suffixe()}`;
      await prisma.account.create({ data: { id: visiteurId, email: `${visiteurId}@test.local` } });

      const demande = await logement(visiteurId);
      const avecAcompte = new ServiceDemandes(depot, acomptes);
      const acceptee = await avecAcompte.accepterParPartenaire(demande.id);
      await avecAcompte.confirmer(demande.id);

      const veilleurEnRetard = new ServiceDemandes(avecLecturesFigees(acceptee), acomptes);
      expect(await codeDe(veilleurEnRetard.transitionner(demande.id, "expiree", "systeme"))).toBe(
        "TRANSITION_CONCURRENTE",
      );

      const dossier = await prisma.depositPayment.findUniqueOrThrow({ where: { demandeId: demande.id } });
      expect(dossier.statut).toBe("en_attente");
    });
  });

  describe("le veilleur", () => {
    it("passe à la demande suivante après un conflit", async () => {
      const confirmee = await logement();
      const instantane = await service.accepterParPartenaire(confirmee.id);
      await service.confirmer(confirmee.id);

      const aExpirer = await logement();
      await service.accepterParPartenaire(aExpirer.id);

      // Le veilleur croit les deux « acceptee » et échues ; la première a été
      // confirmée entre-temps.
      const demandes = new ServiceDemandes(avecLecturesFigees(instantane));
      const depotVeille = { aExpirer: async () => [confirmee.id, aExpirer.id] } as unknown as DepotDemandes;
      const veilleur = new VeilleurDemandes(
        depotVeille,
        demandes,
        {} as ServiceComptes,
        {} as ServiceEmail,
      );

      await veilleur.veiller(new Date());

      expect((await enBase(confirmee.id)).statut).toBe("confirmee");
      expect((await enBase(aExpirer.id)).statut).toBe("expiree");
    });
  });

  describe("les parcours normaux", () => {
    it("acceptation, confirmation, annulation", async () => {
      const demande = await logement();
      expect((await service.accepterParPartenaire(demande.id)).statut).toBe("acceptee");
      const confirmee = await service.confirmer(demande.id);
      expect(confirmee.statut).toBe("confirmee");
      // Aucune coordonnée fabriquée : elles sont saisies par l'équipe.
      expect(confirmee.coordonnees).toBeUndefined();
      expect(confirmee.expireLe).toBeUndefined();

      const annulee = await service.annuler(demande.id);
      expect(annulee.statut).toBe("annulee");
      expect(annulee.coordonnees).toBeUndefined();
      expect(annulee.frise.map((e) => e.statut)).toEqual(["envoyee", "acceptee", "confirmee", "annulee"]);
    });

    it("refus par le partenaire", async () => {
      const demande = await logement();
      const refusee = await service.refuserParPartenaire(demande.id, "plus-disponible");
      expect(refusee.statut).toBe("refusee");
      expect(refusee.motifRefus).toBe("plus-disponible");
      expect((await enBase(demande.id)).statut).toBe("refusee");
    });

    it("expiration par le système", async () => {
      const demande = await logement();
      await service.accepterParPartenaire(demande.id);
      const expiree = await service.transitionner(demande.id, "expiree", "systeme");
      expect(expiree.statut).toBe("expiree");
      expect(expiree.expireLe).toBeUndefined();
      expect((await enBase(demande.id)).expireLe).toBeNull();
    });

    it("une transition interdite reste interdite, et non « concurrente »", async () => {
      const demande = await logement();
      expect(await codeDe(service.confirmer(demande.id))).toBe("TRANSITION_INTERDITE");
    });
  });
});
