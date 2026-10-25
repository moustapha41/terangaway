import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotDemandesPrisma } from "../demandes/demandes.prisma";
import { ServiceDemandes } from "../demandes/demandes.service";
import { DepotAcomptesPrisma } from "./acomptes.prisma";
import { fenetreUnique, instantUnique, reserverFenetres } from "../demandes/fenetres-uniques.test-utils";

/** Le code stable d'une erreur métier, pour décider dessus comme le site. */
async function codeDe(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return (erreur.getResponse() as { code: string }).code;
    throw erreur;
  }
  throw new Error("La promesse aurait dû échouer.");
}

/** Une échéance posée en dur, pour les insertions directes en base. */
const ECHEANCE = "2026-11-02T08:00:00.000Z";

/**
 * L'instant d'acceptation remis au dépôt. C'est lui, désormais, qui en déduit
 * l'échéance : douze heures pour un logement, trois pour une location, et
 * jamais au-delà du `expireLe` de la demande.
 *
 * Maintenant, et non une date figée : l'échéance est plafonnée par celle de la
 * demande, que les fixtures calculent depuis l'heure courante. Une acceptation
 * datée de l'an prochain tomberait après cette échéance, et le dépôt la
 * refuserait — à juste titre.
 */
const accepteeMaintenant = () => new Date().toISOString();

describe("Persistance PostgreSQL — Module Acomptes", () => {
  let prisma: PrismaService;
  let depot: DepotAcomptesPrisma;
  let demandes: DepotDemandesPrisma;
  let administrateurId: string;

  const suffixe = () => randomBytes(4).toString("hex");

  const logement = async () =>
    demandes.creerLogement({
      logementId: "l-001",
      ...fenetreUnique(4),
      personnes: 2,
      visiteurId: `visiteur-acompte-${suffixe()}`,
    });

  const vehicule = async (prestation: "trajet" | "journee" | "taxi") =>
    demandes.creerVehicule({
      vehiculeId: "v-001",
      prestation,
      depart: "Dakar",
      arrivee: "Saly",
      quand: instantUnique("09:00"),
      passagers: 2,
      bagages: 1,
      visiteurId: `visiteur-acompte-${suffixe()}`,
    });

  /**
   * Prépare un acompte à 30 % sur un logement neuf, **accepté** : c'est le seul
   * moment où un acompte existe, et le seul où il peut être déclaré payé.
   */
  const acompteNeuf = async () => {
    const demande = await new ServiceDemandes(demandes).accepterParPartenaire((await logement()).id);
    const { acompte } = await depot.preparer({
      demandeId: demande.id,
      pourcentage: 30,
      accepteeLe: accepteeMaintenant(),
    });
    return { demande, acompte };
  };

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    await reserverFenetres(prisma);
    depot = new DepotAcomptesPrisma(prisma);
    demandes = new DepotDemandesPrisma(
      prisma,
      new DepotLogementsFixtures(),
      new DepotVehiculesFixtures(),
    );
    const admin = await prisma.account.create({
      data: { email: `admin-acompte-${suffixe()}@test.local`, role: "ADMINISTRATEUR" },
    });
    administrateurId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("préparation", () => {
    it("ouvre un dossier figé à 30 % du prix, sans rien envoyer", async () => {
      const demande = await logement();
      const { acompte, cree } = await depot.preparer({
        demandeId: demande.id,
        pourcentage: 30,
        accepteeLe: accepteeMaintenant(),
      });

      expect(cree).toBe(true);
      expect(acompte.demandeId).toBe(demande.id);
      expect(acompte.referenceVirement).toBe(demande.reference);
      expect(acompte.statut).toBe("en_attente");
      expect(acompte.pourcentageApplique).toBe(30);
      expect(acompte.montantTotal).toBe(demande.prix.total);
      expect(acompte.montantAttendu).toBe(Math.round((demande.prix.total * 30) / 100));
      expect(acompte.montantRecu).toBe(0);
      expect(acompte.devise).toBe("XOF");
      // L'échéance n'est plus dictée par l'appelant : elle vient du genre, et
      // elle est ici plafonnée par celle de la demande. Un logement encore
      // « envoyée » expire dans deux heures (délai de réponse du partenaire),
      // bien avant les douze heures de paiement : c'est donc le plafond qui
      // s'applique, et c'est précisément ce qu'on veut vérifier.
      expect(acompte.echeanceLe).toBe(demande.expireLe);
      // Préparer n'est pas réclamer : aucune instruction n'est partie.
      expect(acompte.instructionsEnvoyeesLe).toBeUndefined();
      expect(acompte.rappeleLe).toBeUndefined();
      expect(acompte.confirmeParId).toBeUndefined();

      const journal = await depot.journal(acompte.id);
      expect(journal).toHaveLength(1);
      expect(journal[0]).toMatchObject({
        type: "preparation",
        statutApres: "en_attente",
        montant: acompte.montantAttendu,
      });
      expect(journal[0].acteurId).toBeUndefined();
    });

    it("accepte la location et lui accorde douze heures, plafonnées par la demande", async () => {
      const demande = await vehicule("journee");
      // Une demande « acceptée » a une fenêtre de douze heures ; on la pose
      // comme `transitionner` le ferait, pour éprouver le délai du genre seul.
      await prisma.demand.update({ where: { id: demande.id }, data: { expireLe: new Date(Date.now() + 24 * 3_600_000) } });
      const accepteeLe = accepteeMaintenant();
      const { cree, acompte } = await depot.preparer({
        demandeId: demande.id,
        pourcentage: 30,
        accepteeLe,
      });
      expect(cree).toBe(true);
      expect(acompte.montantAttendu).toBe(Math.round((38000 * 30) / 100));

      expect(Date.parse(acompte.echeanceLe) - Date.parse(accepteeLe)).toBe(12 * 3_600_000);
    });

    it("plafonne l'échéance d'une location à l'expiration de sa demande quand celle-ci arrive avant", async () => {
      // Une location « envoyée » expire dans six heures : l'acompte n'est pas
      // exigible au-delà, quel que soit le délai du genre.
      const demande = await vehicule("journee");
      const accepteeLe = accepteeMaintenant();
      const { acompte } = await depot.preparer({ demandeId: demande.id, pourcentage: 30, accepteeLe });
      const expireLe = (await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } })).expireLe!;
      expect(Date.parse(acompte.echeanceLe)).toBe(expireLe.getTime());
      expect(Date.parse(acompte.echeanceLe) - Date.parse(accepteeLe)).toBeLessThan(12 * 3_600_000);
    });

    it("refuse le taxi et le trajet, sans rien écrire", async () => {
      for (const prestation of ["taxi", "trajet"] as const) {
        const demande = await vehicule(prestation);
        expect(
          await codeDe(depot.preparer({ demandeId: demande.id, pourcentage: 30, accepteeLe: accepteeMaintenant() })),
        ).toBe("ACOMPTE_GENRE_NON_ELIGIBLE");
        expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(0);
      }
    });

    it("refuse une demande inconnue, un taux invalide et une acceptation illisible", async () => {
      expect(
        await codeDe(depot.preparer({ demandeId: "d-inexistante", pourcentage: 30, accepteeLe: accepteeMaintenant() })),
      ).toBe("DEMANDE_INTROUVABLE");

      const demande = await logement();
      for (const pourcentage of [0, 101, 12.5]) {
        expect(
          await codeDe(depot.preparer({ demandeId: demande.id, pourcentage, accepteeLe: accepteeMaintenant() })),
        ).toBe("ACOMPTE_TAUX_INVALIDE");
      }
      expect(
        await codeDe(depot.preparer({ demandeId: demande.id, pourcentage: 30, accepteeLe: "demain" })),
      ).toBe("ACOMPTE_ECHEANCE_INVALIDE");
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(0);
    });

    it("est idempotente : le premier dossier fait foi", async () => {
      const { demande, acompte } = await acompteNeuf();

      const seconde = await depot.preparer({
        demandeId: demande.id,
        pourcentage: 50,
        accepteeLe: accepteeMaintenant(),
      });

      expect(seconde.cree).toBe(false);
      expect(seconde.acompte).toEqual(acompte);
      expect(await depot.journal(acompte.id)).toHaveLength(1);
    });

    it("résiste aux préparations concurrentes : un seul dossier, un seul événement", async () => {
      const demande = await logement();
      const resultats = await Promise.all(
        Array.from({ length: 6 }, () =>
          depot.preparer({ demandeId: demande.id, pourcentage: 30, accepteeLe: accepteeMaintenant() }),
        ),
      );

      expect(resultats.filter((r) => r.cree)).toHaveLength(1);
      expect(new Set(resultats.map((r) => r.acompte.id)).size).toBe(1);
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(1);
      expect(
        await prisma.depositPaymentEvent.count({
          where: { acompte: { demandeId: demande.id }, type: "preparation" },
        }),
      ).toBe(1);
    });
  });

  describe("contraintes de la base", () => {
    it("refuse un second dossier pour la même demande, même hors du dépôt", async () => {
      const { demande } = await acompteNeuf();
      await expect(
        prisma.depositPayment.create({
          data: {
            demandeId: demande.id,
            pourcentageApplique: 30,
            montantTotal: 1000,
            montantAttendu: 300,
            echeanceLe: new Date(ECHEANCE),
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    it("refuse un acompte qui réclame zéro, ou plus que le prix", async () => {
      const demande = await logement();
      const base = { demandeId: demande.id, pourcentageApplique: 30, echeanceLe: new Date(ECHEANCE) };
      await expect(
        prisma.depositPayment.create({ data: { ...base, montantTotal: 1000, montantAttendu: 0 } }),
      ).rejects.toThrow(/deposit_payments_montant_attendu_check/);
      await expect(
        prisma.depositPayment.create({ data: { ...base, montantTotal: 1000, montantAttendu: 1001 } }),
      ).rejects.toThrow(/deposit_payments_montant_attendu_check/);
      await expect(
        prisma.depositPayment.create({
          data: { ...base, pourcentageApplique: 0, montantTotal: 1000, montantAttendu: 300 },
        }),
      ).rejects.toThrow(/deposit_payments_pourcentage_check/);
    });

    it("refuse d'effacer une demande qui porte un dossier d'acompte", async () => {
      const { demande } = await acompteNeuf();
      await expect(prisma.demand.delete({ where: { id: demande.id } })).rejects.toThrow();
      expect(await prisma.demand.count({ where: { id: demande.id } })).toBe(1);
    });
  });

  describe("statut", () => {
    it("se lit par identifiant et par demande", async () => {
      const { demande, acompte } = await acompteNeuf();
      expect(await depot.parId(acompte.id)).toEqual(acompte);
      expect(await depot.parDemande(demande.id)).toEqual(acompte);
      expect(await depot.parId("inexistant")).toBeNull();
      expect(await depot.parDemande("d-inexistante")).toBeNull();
    });

    it("franchit une transition autorisée et la consigne", async () => {
      const { acompte } = await acompteNeuf();
      const expire = await depot.changerStatut(
        acompte.id,
        { de: "en_attente", vers: "expire" },
        { type: "expiration_prononcee" },
      );

      expect(expire.statut).toBe("expire");
      const journal = await depot.journal(acompte.id);
      expect(journal.at(-1)).toMatchObject({
        type: "expiration_prononcee",
        statutAvant: "en_attente",
        statutApres: "expire",
      });
    });

    it("refuse une transition hors contrat, sans rien écrire", async () => {
      const { acompte } = await acompteNeuf();
      await depot.changerStatut(acompte.id, { de: "en_attente", vers: "annule" }, { type: "annulation" });

      expect(
        await codeDe(
          depot.changerStatut(
            acompte.id,
            { de: "annule", vers: "paye" },
            { type: "reception_confirmee", montant: acompte.montantAttendu, acteurId: administrateurId },
          ),
        ),
      ).toBe("ACOMPTE_TRANSITION_INTERDITE");

      const apres = await depot.parId(acompte.id);
      expect(apres!.statut).toBe("annule");
      expect(apres!.montantRecu).toBe(0);
      expect(await depot.journal(acompte.id)).toHaveLength(2);
    });

    it("refuse d'écraser un statut changé entre-temps", async () => {
      const { acompte } = await acompteNeuf();
      await depot.changerStatut(acompte.id, { de: "en_attente", vers: "annule" }, { type: "annulation" });

      // Un second acteur croit encore lire « en_attente ».
      expect(
        await codeDe(
          depot.changerStatut(acompte.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" }),
        ),
      ).toBe("ACOMPTE_STATUT_CONCURRENT");
      expect((await depot.parId(acompte.id))!.statut).toBe("annule");
      expect(await depot.journal(acompte.id)).toHaveLength(2);
    });

    it("signale un acompte inconnu", async () => {
      expect(
        await codeDe(depot.changerStatut("inexistant", { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" })),
      ).toBe("ACOMPTE_INTROUVABLE");
      expect(await codeDe(depot.consigner("inexistant", { type: "verification", acteurId: administrateurId }))).toBe("ACOMPTE_INTROUVABLE");
    });
  });

  describe("transactions", () => {
    it("annule tout quand « payé » ment sur le montant : ni statut, ni cumul, ni événement", async () => {
      const { acompte } = await acompteNeuf();
      expect(
        await codeDe(
          depot.changerStatut(
            acompte.id,
            { de: "en_attente", vers: "paye" },
            { type: "reception_confirmee", montant: acompte.montantAttendu - 1, acteurId: administrateurId },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");

      const apres = await depot.parId(acompte.id);
      expect(apres!.statut).toBe("en_attente");
      expect(apres!.montantRecu).toBe(0);
      expect(await depot.journal(acompte.id)).toHaveLength(1);
    });

    it("refuse « partiel » quand tout est reçu", async () => {
      const { acompte } = await acompteNeuf();
      expect(
        await codeDe(
          depot.changerStatut(
            acompte.id,
            { de: "en_attente", vers: "partiel" },
            { type: "reception_confirmee", montant: acompte.montantAttendu, acteurId: administrateurId },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect((await depot.parId(acompte.id))!.montantRecu).toBe(0);
    });

    it("refuse une réception sans personne pour la constater, ou sans montant", async () => {
      const { acompte } = await acompteNeuf();
      expect(
        await codeDe(depot.consigner(acompte.id, { type: "reception_confirmee", montant: 1000 })),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect(
        await codeDe(depot.consigner(acompte.id, { type: "reception_confirmee", acteurId: administrateurId })),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect(
        await codeDe(depot.consigner(acompte.id, { type: "anomalie_signalee", montant: -5 })),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect(
        await codeDe(depot.changerStatut(acompte.id, { de: "en_attente", vers: "paye" }, { type: "verification" })),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect(await depot.journal(acompte.id)).toHaveLength(1);
    });

    it("annule le cumul si l'événement ne peut pas s'écrire (acteur inconnu)", async () => {
      const { acompte } = await acompteNeuf();
      await expect(
        depot.enregistrerReception({
          acompteId: acompte.id,
          montant: 1000,
          montantRecuAvant: 0,
          acteurId: "compte-inexistant",
          ecartConfirme: true,
          commentaire: "essai",
        }),
      ).rejects.toThrow();
      expect((await depot.parId(acompte.id))!.montantRecu).toBe(0);
      expect(await depot.journal(acompte.id)).toHaveLength(1);
    });
  });

  describe("journal", () => {
    it("raconte deux versements, une preuve et un doublon sans rien écraser", async () => {
      const { acompte } = await acompteNeuf();
      const premier = Math.floor(acompte.montantAttendu / 2);
      const reste = acompte.montantAttendu - premier;

      await depot.consigner(acompte.id, {
        type: "preuve_declaree",
        montant: acompte.montantAttendu,
        commentaire: "Le visiteur dit avoir tout viré.",
      });
      const partiel = await depot.changerStatut(
        acompte.id,
        { de: "en_attente", vers: "partiel" },
        { type: "reception_confirmee", montant: premier, acteurId: administrateurId, referenceTransaction: "VIR-1" },
      );
      expect(partiel.montantRecu).toBe(premier);

      const avant = await depot.journal(acompte.id);

      await depot.consigner(acompte.id, {
        type: "doublon_signale",
        montant: premier,
        acteurId: administrateurId,
        referenceTransaction: "VIR-1",
      });
      const paye = await depot.changerStatut(
        acompte.id,
        { de: "partiel", vers: "paye" },
        { type: "reception_confirmee", montant: reste, acteurId: administrateurId, referenceTransaction: "VIR-2" },
      );

      // Un doublon et une preuve déclarée ne comptent pas : seul ce qui est constaté compte.
      expect(paye.statut).toBe("paye");
      expect(paye.montantRecu).toBe(acompte.montantAttendu);
      expect(paye.confirmeParId).toBe(administrateurId);
      expect(paye.referenceTransaction).toBe("VIR-2");
      expect(paye.confirmeLe).toBeDefined();

      const journal = await depot.journal(acompte.id);
      expect(journal.map((e) => e.type)).toEqual([
        "preparation",
        "preuve_declaree",
        "reception_confirmee",
        "doublon_signale",
        "reception_confirmee",
      ]);
      // L'histoire déjà écrite est intacte, ligne pour ligne.
      expect(journal.slice(0, avant.length)).toEqual(avant);
      expect(new Set(journal.map((e) => e.id)).size).toBe(journal.length);
    });

    it("trace une réception tardive puis la décision de rembourser", async () => {
      const { acompte } = await acompteNeuf();
      await depot.changerStatut(acompte.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      await depot.enregistrerReception({
        acompteId: acompte.id,
        montant: acompte.montantAttendu,
        montantRecuAvant: 0,
        acteurId: administrateurId,
        ecartConfirme: false,
      });
      const aRembourser = await depot.changerStatut(
        acompte.id,
        { de: "expire", vers: "a_rembourser" },
        { type: "remboursement_decide", montant: acompte.montantAttendu, acteurId: administrateurId },
      );
      expect(aRembourser.statut).toBe("a_rembourser");
      expect(aRembourser.montantRecu).toBe(acompte.montantAttendu);
      expect((await depot.journal(acompte.id)).map((e) => e.type)).toEqual([
        "preparation",
        "expiration_prononcee",
        "reception_confirmee",
        "remboursement_decide",
      ]);
    });

    it("est append-only jusque dans la base : ni UPDATE, ni DELETE", async () => {
      const { acompte } = await acompteNeuf();
      const [ligne] = await depot.journal(acompte.id);

      await expect(
        prisma.depositPaymentEvent.update({ where: { id: ligne.id }, data: { commentaire: "réécrit" } }),
      ).rejects.toThrow(/append-only/);
      await expect(prisma.depositPaymentEvent.delete({ where: { id: ligne.id } })).rejects.toThrow(/append-only/);
      await expect(
        prisma.$executeRaw`UPDATE "deposit_payment_events" SET "montant" = 1 WHERE "id" = ${ligne.id}`,
      ).rejects.toThrow(/append-only/);

      expect(await depot.journal(acompte.id)).toEqual([ligne]);
    });
  });

  describe("périmètre", () => {
    it("ne touche jamais la demande : ni statut, ni échéance, ni date de mise à jour", async () => {
      const demande = await logement();
      const avant = await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } });

      const { acompte } = await depot.preparer({ demandeId: demande.id, pourcentage: 30, accepteeLe: accepteeMaintenant() });
      await depot.preparer({ demandeId: demande.id, pourcentage: 30, accepteeLe: accepteeMaintenant() });
      await depot.changerStatut(
        acompte.id,
        { de: "en_attente", vers: "partiel" },
        { type: "reception_confirmee", montant: 1, acteurId: administrateurId },
      );
      await depot.changerStatut(acompte.id, { de: "partiel", vers: "expire" }, { type: "expiration_prononcee" });

      expect(await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } })).toEqual(avant);
    });

    it("ne pose jamais les marqueurs d'envoi : rien n'est parti vers personne", async () => {
      const { acompte } = await acompteNeuf();
      await depot.consigner(acompte.id, { type: "verification", acteurId: administrateurId });
      await depot.changerStatut(acompte.id, { de: "en_attente", vers: "annule" }, { type: "annulation" });

      const ligne = await prisma.depositPayment.findUniqueOrThrow({ where: { id: acompte.id } });
      expect(ligne.instructionsEnvoyeesLe).toBeNull();
      expect(ligne.rappeleLe).toBeNull();
    });
  });
});
