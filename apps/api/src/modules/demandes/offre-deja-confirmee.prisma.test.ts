import { randomBytes } from "node:crypto";

import type { Demande } from "@teranga/contracts";
import type { Resend } from "resend";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier } from "../../commun/erreurs";
import type { ConfigAcompte } from "../../config/configuration";
import { DepotAcomptesPrisma } from "../acomptes/acomptes.prisma";
import { ServiceAcomptes } from "../acomptes/acomptes.service";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotDemandesPrisma } from "./demandes.prisma";
import { ServiceDemandes } from "./demandes.service";
import { fenetreUnique, instantUnique, reserverFenetres } from "./fenetres-uniques.test-utils";
import { autreDemandeConfirmeeEnConflit, verrouillerOffre } from "./occupation";

/** Sentinelles : aucune coordonnée réelle dans ce dépôt. */
const OUVERTE: ConfigAcompte = {
  actif: true,
  pourcentage: 30,
  etatCoordonnees: "defini",
  beneficiaire: { titulaire: "TITULAIRE-DE-TEST", banque: "BANQUE-DE-TEST", iban: "IBANDETESTNEPASUTILISER", bic: "BICDETEST" },
};
const FERMEE: ConfigAcompte = { actif: false, pourcentage: undefined, etatCoordonnees: "absent", beneficiaire: undefined };

/**
 * Une offre ne se confirme qu'une fois sur des dates qui se recouvrent — sur PostgreSQL
 * (base `teranga_test` seule). Chaque test prend ses propres dates : la base est
 * persistante, et des confirmations anciennes occupent déjà les dates habituelles.
 */
describe("Double réservation — une offre, une confirmation par période", () => {
  let prisma: PrismaService;
  let depotDemandes: DepotDemandesPrisma;
  let depotAcomptes: DepotAcomptesPrisma;
  let send: ReturnType<typeof vi.fn>;
  let adminId: string;

  const suffixe = () => randomBytes(4).toString("hex");

  /** Trois câblages : acompte ouvert, acompte fermé, et aucun service d'acompte du tout. */
  const monter = () => {
    const email = new ServiceEmail({ emails: { send } } as unknown as Resend);
    const ouverte = new ServiceAcomptes(depotAcomptes, email, OUVERTE);
    const fermee = new ServiceAcomptes(depotAcomptes, email, FERMEE);
    return {
      ouverte,
      fermee,
      avecAcompte: new ServiceDemandes(depotDemandes, ouverte),
      acompteFerme: new ServiceDemandes(depotDemandes, fermee),
      sansAcompte: new ServiceDemandes(depotDemandes),
    };
  };

  async function visiteur() {
    const id = `visiteur-offre-${suffixe()}`;
    await prisma.account.create({ data: { id, email: `${id}@test.local` } });
    return id;
  }

  const logement = async (fenetre: { debut: string; fin: string }, logementId = "l-001") =>
    depotDemandes.creerLogement({ logementId, ...fenetre, personnes: 2, visiteurId: await visiteur() });

  const vehicule = async (
    prestation: "trajet" | "journee" | "taxi",
    quand: string,
    vehiculeId = "v-001",
  ) =>
    depotDemandes.creerVehicule({
      vehiculeId, prestation, depart: "Dakar", arrivee: "Saly", quand, passagers: 2, bagages: 0,
      visiteurId: await visiteur(),
    });

  /** Une demande acceptée puis confirmée par le visiteur — sans acompte. */
  async function confirmee(demande: Demande) {
    const { acompteFerme } = monter();
    await acompteFerme.accepterParPartenaire(demande.id);
    return acompteFerme.confirmer(demande.id);
  }

  const codeDe = async (promesse: Promise<unknown>): Promise<string> => {
    try {
      await promesse;
    } catch (e) {
      if (e instanceof ErreurMetier) return (e.getResponse() as { code: string }).code;
      throw e;
    }
    return "AUCUN_REFUS";
  };

  const statutDe = async (id: string) =>
    (await prisma.demand.findUniqueOrThrow({ where: { id }, select: { statut: true } })).statut;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    await reserverFenetres(prisma);
    depotDemandes = new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures());
    depotAcomptes = new DepotAcomptesPrisma(prisma);
    adminId = (await prisma.account.create({ data: { email: `admin-offre-${suffixe()}@test.local`, role: "ADMINISTRATEUR" } })).id;
  });

  beforeEach(() => {
    send = vi.fn().mockResolvedValue({ data: { id: "em_test" }, error: null });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /* ───────────────────────────── Logements ───────────────────────────── */

  describe("logements", () => {
    it("refuse la même offre aux mêmes dates : 409 OFFRE_DEJA_CONFIRMEE, la seconde reste acceptée", async () => {
      const f = fenetreUnique(4);
      const premiere = await logement(f);
      const seconde = await logement(f);
      await confirmee(premiere);

      const { acompteFerme } = monter();
      await acompteFerme.accepterParPartenaire(seconde.id);
      let erreur: ErreurMetier | undefined;
      await acompteFerme.confirmer(seconde.id).catch((e) => (erreur = e));

      expect(erreur).toBeInstanceOf(ErreurMetier);
      expect(erreur!.getStatus()).toBe(409);
      expect(erreur!.getResponse()).toMatchObject({ code: "OFFRE_DEJA_CONFIRMEE" });
      expect(await statutDe(premiere.id)).toBe("confirmee");
      expect(await statutDe(seconde.id)).toBe("acceptee");
    });

    it.each([
      ["chevauchement partiel, la seconde commence dans la première", 2, 4],
      ["chevauchement partiel, la seconde finit dans la première", -2, 4],
      ["incluse dans la première", 1, 2],
      ["englobante", -1, 8],
      ["une seule nuit commune", 3, 5],
    ])("refuse : %s", async (_nom, decalage, nuits) => {
      const f = fenetreUnique(4);
      const decale = (jours: number) => new Date(Date.parse(`${f.debut}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);
      await confirmee(await logement(f));

      const seconde = await logement({ debut: decale(decalage), fin: decale(decalage + nuits) });
      const { acompteFerme } = monter();
      await acompteFerme.accepterParPartenaire(seconde.id);
      expect(await codeDe(acompteFerme.confirmer(seconde.id))).toBe("OFFRE_DEJA_CONFIRMEE");
    });

    it("accepte les séjours adjacents : le départ de l'un est l'arrivée de l'autre", async () => {
      const f = fenetreUnique(4);
      const decale = (jours: number) => new Date(Date.parse(`${f.debut}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);

      await confirmee(await logement(f)); // [j, j+4)
      const apres = await confirmee(await logement({ debut: decale(4), fin: decale(7) })); // [j+4, j+7)
      const avant = await confirmee(await logement({ debut: decale(-3), fin: decale(0) })); // [j-3, j)
      expect(apres.statut).toBe("confirmee");
      expect(avant.statut).toBe("confirmee");
    });

    it("n'empêche pas deux offres différentes aux mêmes dates", async () => {
      const f = fenetreUnique(4);
      await confirmee(await logement(f, "l-001"));
      const autre = await confirmee(await logement(f, "l-002"));
      expect(autre.statut).toBe("confirmee");
    });

    it.each(["refusee", "expiree", "annulee", "acceptee", "envoyee"] as const)(
      "une autre demande « %s » n'occupe pas l'offre",
      async (statut) => {
        const f = fenetreUnique(4);
        const autre = await logement(f);
        const { acompteFerme } = monter();
        if (statut === "refusee") await acompteFerme.refuserParPartenaire(autre.id);
        if (statut === "expiree") {
          await acompteFerme.accepterParPartenaire(autre.id);
          await acompteFerme.transitionner(autre.id, "expiree", "systeme");
        }
        if (statut === "annulee") {
          await acompteFerme.accepterParPartenaire(autre.id);
          await acompteFerme.annuler(autre.id);
        }
        if (statut === "acceptee") await acompteFerme.accepterParPartenaire(autre.id);
        expect(await statutDe(autre.id)).toBe(statut);

        const demande = await logement(f);
        expect((await confirmee(demande)).statut).toBe("confirmee");
      },
    );

    it("une réservation confirmée puis annulée libère l'offre", async () => {
      const f = fenetreUnique(4);
      const premiere = await logement(f);
      await confirmee(premiere);
      const seconde = await logement(f);
      const { acompteFerme } = monter();
      await acompteFerme.accepterParPartenaire(seconde.id);
      expect(await codeDe(acompteFerme.confirmer(seconde.id))).toBe("OFFRE_DEJA_CONFIRMEE");

      await acompteFerme.annuler(premiere.id);
      expect((await acompteFerme.confirmer(seconde.id)).statut).toBe("confirmee");
    });

    it("une demande ne se bloque pas elle-même", async () => {
      const demande = await logement(fenetreUnique(4));
      await confirmee(demande);
      const ligne = await prisma.demand.findUniqueOrThrow({
        where: { id: demande.id }, select: { id: true, offreId: true, genre: true, dateDebut: true, dateFin: true },
      });
      expect(await autreDemandeConfirmeeEnConflit(prisma, ligne)).toBe(false);
    });

    it("la garde fonctionne avec l'acompte fermé et sans aucun service d'acompte (ACOMPTE_ACTIF=false)", async () => {
      const { acompteFerme, sansAcompte } = monter();
      for (const service of [acompteFerme, sansAcompte]) {
        const f = fenetreUnique(4);
        await confirmee(await logement(f));
        const seconde = await logement(f);
        await service.accepterParPartenaire(seconde.id);
        expect(await codeDe(service.confirmer(seconde.id))).toBe("OFFRE_DEJA_CONFIRMEE");
        expect(await statutDe(seconde.id)).toBe("acceptee");
        // Et rien n'a ouvert de dossier d'acompte.
        expect(await depotAcomptes.parDemande(seconde.id)).toBeNull();
      }
    });
  });

  /* ───────────────────────────── Locations ───────────────────────────── */

  describe("locations de véhicule", () => {
    it("une seule réservation par véhicule et par jour : l'heure n'y change rien", async () => {
      const jour = instantUnique("09:00").slice(0, 10);
      await confirmee(await vehicule("journee", `${jour}T09:00`));

      const memeJour = await vehicule("journee", `${jour}T17:30`);
      const { acompteFerme } = monter();
      await acompteFerme.accepterParPartenaire(memeJour.id);
      expect(await codeDe(acompteFerme.confirmer(memeJour.id))).toBe("OFFRE_DEJA_CONFIRMEE");
      expect(await statutDe(memeJour.id)).toBe("acceptee");
    });

    it("des jours différents cohabitent, ainsi que deux véhicules le même jour", async () => {
      const jour = instantUnique("09:00").slice(0, 10);
      const lendemain = new Date(Date.parse(`${jour}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      await confirmee(await vehicule("journee", `${jour}T09:00`, "v-001"));

      expect((await confirmee(await vehicule("journee", `${lendemain}T09:00`, "v-001"))).statut).toBe("confirmee");
      expect((await confirmee(await vehicule("journee", `${jour}T09:00`, "v-002"))).statut).toBe("confirmee");
    });

    it("ne change rien pour les trajets et les taxis : deux courses au même instant se confirment", async () => {
      const quand = instantUnique("10:00");
      const premier = await confirmee(await vehicule("trajet", quand));
      const second = await confirmee(await vehicule("trajet", quand));
      const taxi = await confirmee(await vehicule("taxi", quand));
      expect([premier, second, taxi].map((d) => d.statut)).toEqual(["confirmee", "confirmee", "confirmee"]);
    });

    it("un trajet confirmé ne bloque pas une location le même jour (règle des taxis et trajets inchangée)", async () => {
      const jour = instantUnique("09:00").slice(0, 10);
      await confirmee(await vehicule("trajet", `${jour}T09:00`));
      expect((await confirmee(await vehicule("journee", `${jour}T09:00`))).statut).toBe("confirmee");
    });
  });

  /* ───────────────────────────── Concurrence ───────────────────────────── */

  describe("concurrence : deux demandes payées confirment en même temps", () => {
    /** Une demande acceptée, dossier ouvert et acompte payé et vérifié. */
    async function payee(f: { debut: string; fin: string }, avecAcompte: ServiceDemandes, acomptes: ServiceAcomptes) {
      const demande = await logement(f);
      await avecAcompte.accepterParPartenaire(demande.id);
      const dossier = (await depotAcomptes.parDemande(demande.id))!;
      await acomptes.confirmerReception(demande.id, { montant: dossier.montantAttendu, montantRecuAvant: 0 }, adminId);
      return demande;
    }

    it("une seule réussit, l'autre reçoit OFFRE_DEJA_CONFIRMEE (20 tours)", async () => {
      const { avecAcompte, ouverte } = monter();
      for (let tour = 0; tour < 20; tour++) {
        const f = fenetreUnique(4);
        const a = await payee(f, avecAcompte, ouverte);
        const b = await payee(f, avecAcompte, ouverte);

        const issues = await Promise.allSettled([avecAcompte.confirmer(a.id), avecAcompte.confirmer(b.id)]);
        const reussies = issues.filter((i) => i.status === "fulfilled");
        const refus = issues.filter((i): i is PromiseRejectedResult => i.status === "rejected");

        expect(reussies, `tour ${tour}`).toHaveLength(1);
        expect(refus, `tour ${tour}`).toHaveLength(1);
        expect((refus[0].reason as ErreurMetier).getResponse(), `tour ${tour}`).toMatchObject({ code: "OFFRE_DEJA_CONFIRMEE" });

        const statuts = [await statutDe(a.id), await statutDe(b.id)].sort();
        expect(statuts, `tour ${tour}`).toEqual(["acceptee", "confirmee"]);
      }
    });

    it("trois demandes payées : exactement une confirmée", async () => {
      const { avecAcompte, ouverte } = monter();
      const f = fenetreUnique(4);
      const demandes = [await payee(f, avecAcompte, ouverte), await payee(f, avecAcompte, ouverte), await payee(f, avecAcompte, ouverte)];
      const issues = await Promise.allSettled(demandes.map((d) => avecAcompte.confirmer(d.id)));
      expect(issues.filter((i) => i.status === "fulfilled")).toHaveLength(1);
      const statuts = await Promise.all(demandes.map((d) => statutDe(d.id)));
      expect(statuts.filter((s) => s === "confirmee")).toHaveLength(1);
    });

    it("deux offres différentes ne se bloquent pas : les deux confirment", async () => {
      const { avecAcompte, ouverte } = monter();
      const f = fenetreUnique(4);
      const a = await logement(f, "l-001");
      const b = await logement(f, "l-002");
      await avecAcompte.accepterParPartenaire(a.id);
      await avecAcompte.accepterParPartenaire(b.id);
      for (const d of [a, b]) {
        const dossier = (await depotAcomptes.parDemande(d.id))!;
        await ouverte.confirmerReception(d.id, { montant: dossier.montantAttendu, montantRecuAvant: 0 }, adminId);
      }
      const issues = await Promise.allSettled([avecAcompte.confirmer(a.id), avecAcompte.confirmer(b.id)]);
      expect(issues.map((i) => i.status)).toEqual(["fulfilled", "fulfilled"]);
    });

    it("le verrou est par offre : il retient la même offre, jamais une autre", async () => {
      const { acompteFerme } = monter();
      const f = fenetreUnique(4);
      const surA = await logement(f, "l-001");
      const surB = await logement(f, "l-002");
      await acompteFerme.accepterParPartenaire(surA.id);
      await acompteFerme.accepterParPartenaire(surB.id);

      let termineeA = false;
      let termineeB = false;
      let confirmationA: Promise<unknown> | undefined;
      let confirmationB: Promise<unknown> | undefined;

      await prisma.$transaction(async (tx) => {
        // Quelqu'un est en train de confirmer l'offre l-001 : son verrou est tenu.
        await verrouillerOffre(tx, "l-001");

        confirmationA = acompteFerme.confirmer(surA.id);
        confirmationB = acompteFerme.confirmer(surB.id);
        confirmationA.then(() => (termineeA = true), () => (termineeA = true));
        confirmationB.then(() => (termineeB = true), () => (termineeB = true));
        await new Promise((resume) => setTimeout(resume, 800));

        expect(termineeB, "une autre offre ne doit pas attendre").toBe(true);
        expect(termineeA, "la même offre doit attendre le verrou").toBe(false);
      });

      await expect(confirmationA!).resolves.toMatchObject({ statut: "confirmee" });
      await expect(confirmationB!).resolves.toMatchObject({ statut: "confirmee" });
    });
  });

  /* ───────────────── Instructions de paiement : protection amont ───────────────── */

  describe("aucune instruction de paiement pour une offre déjà prise", () => {
    it("n'ouvre ni dossier ni e-mail à l'acceptation quand une réservation confirmée occupe l'offre", async () => {
      const f = fenetreUnique(4);
      await confirmee(await logement(f));
      send.mockClear();

      const { avecAcompte, ouverte } = monter();
      const seconde = await logement(f);
      const acceptee = await avecAcompte.accepterParPartenaire(seconde.id);

      expect(acceptee.statut).toBe("acceptee");
      expect(await depotAcomptes.parDemande(seconde.id)).toBeNull();
      expect(send).not.toHaveBeenCalled();

      const vue = await ouverte.lireVue(seconde.id);
      expect(vue.offreDejaConfirmee).toBe(true);
      expect(vue.acompte).toBeUndefined();
      expect(vue.actions.preparer).toBe(false);
    });

    it("l'ouverture manuelle rend un résultat explicite et n'écrit rien", async () => {
      const f = fenetreUnique(4);
      const seconde = await logement(f);
      const { acompteFerme, ouverte } = monter();
      await acompteFerme.accepterParPartenaire(seconde.id); // acompte fermé : pas de dossier
      await confirmee(await logement(f)); // une autre demande occupe l'offre
      send.mockClear();

      expect(await ouverte.ouvrir(seconde.id)).toEqual({ etat: "offre_deja_confirmee" });
      expect(await depotAcomptes.parDemande(seconde.id)).toBeNull();
      expect(send).not.toHaveBeenCalled();
      expect(await prisma.depositPayment.count({ where: { demandeId: seconde.id } })).toBe(0);
    });

    it("l'ouverture manuelle fonctionne comme avant quand l'offre est libre", async () => {
      const f = fenetreUnique(4);
      const demande = await logement(f);
      const { acompteFerme, ouverte } = monter();
      await acompteFerme.accepterParPartenaire(demande.id);
      send.mockClear();

      const issue = await ouverte.ouvrir(demande.id);
      expect(issue).toMatchObject({ etat: "prepare", cree: true, instructions: "envoyees" });
      expect(send).toHaveBeenCalledTimes(1);
      expect((await ouverte.lireVue(demande.id)).offreDejaConfirmee).toBe(false);
    });

    it("conserve le comportement existant pour une demande sans conflit", async () => {
      const { avecAcompte } = monter();
      const demande = await logement(fenetreUnique(4));
      await avecAcompte.accepterParPartenaire(demande.id);
      const dossier = await depotAcomptes.parDemande(demande.id);
      expect(dossier).not.toBeNull();
      expect(dossier!.instructionsEnvoyeesLe).toBeDefined();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("un dossier déjà ouvert n'est pas défait : la préparation reste idempotente", async () => {
      const f = fenetreUnique(4);
      const { avecAcompte, ouverte, acompteFerme } = monter();
      const premiere = await logement(f);
      await acompteFerme.accepterParPartenaire(premiere.id); // sans dossier
      const seconde = await logement(f);
      await avecAcompte.accepterParPartenaire(seconde.id); // libre : dossier et instructions
      expect(await depotAcomptes.parDemande(seconde.id)).not.toBeNull();

      await acompteFerme.confirmer(premiere.id); // l'offre est maintenant prise
      send.mockClear();

      expect(await ouverte.ouvrir(seconde.id)).toMatchObject({ etat: "prepare", cree: false, instructions: "deja_envoyees" });
      expect(send).not.toHaveBeenCalled();
      // La garde de la confirmation, elle, fait foi.
      expect(await codeDe(avecAcompte.confirmer(seconde.id))).toMatch(/OFFRE_DEJA_CONFIRMEE/);
    });

    it("ne retient pas l'offre à l'acceptation : deux demandes sans conflit confirmé reçoivent chacune leurs instructions", async () => {
      const f = fenetreUnique(4);
      const { avecAcompte } = monter();
      const a = await logement(f);
      const b = await logement(f);
      await avecAcompte.accepterParPartenaire(a.id);
      await avecAcompte.accepterParPartenaire(b.id);
      expect(await depotAcomptes.parDemande(a.id)).not.toBeNull();
      expect(await depotAcomptes.parDemande(b.id)).not.toBeNull();
    });
  });

  /* ───────────────────── Le client qui perd la course ───────────────────── */

  describe("le client qui perd la course", () => {
    it("garde son paiement enregistré, n'est pas confirmé, et attend une décision humaine", async () => {
      const f = fenetreUnique(4);
      const { avecAcompte, ouverte } = monter();
      const gagnante = await logement(f);
      const perdante = await logement(f);
      for (const d of [gagnante, perdante]) {
        await avecAcompte.accepterParPartenaire(d.id);
        const dossier = (await depotAcomptes.parDemande(d.id))!;
        await ouverte.confirmerReception(d.id, { montant: dossier.montantAttendu, montantRecuAvant: 0 }, adminId);
      }

      expect((await avecAcompte.confirmer(gagnante.id)).statut).toBe("confirmee");
      expect(await codeDe(avecAcompte.confirmer(perdante.id))).toBe("OFFRE_DEJA_CONFIRMEE");

      // Son argent est enregistré tel quel : ni confirmé, ni remboursé d'office.
      const dossier = (await depotAcomptes.parDemande(perdante.id))!;
      expect(dossier.statut).toBe("paye");
      expect(dossier.montantRecu).toBe(dossier.montantAttendu);
      expect(await statutDe(perdante.id)).toBe("acceptee");
      const journal = await depotAcomptes.journal(dossier.id);
      expect(journal.some((e) => e.type.startsWith("remboursement") || e.statutApres === "a_rembourser")).toBe(false);

      // La décision revient à une personne : la vue la propose, rien n'est fait.
      const vue = await ouverte.lireVue(perdante.id);
      expect(vue.actions.deciderRemboursement).toBe(true);
      expect(vue.acompte!.statut).toBe("paye");
    });

    it("n'est jamais confirmée d'office quand l'offre se libère : c'est au visiteur de confirmer", async () => {
      const f = fenetreUnique(4);
      const { avecAcompte, ouverte } = monter();
      const gagnante = await logement(f);
      const perdante = await logement(f);
      for (const d of [gagnante, perdante]) {
        await avecAcompte.accepterParPartenaire(d.id);
        const dossier = (await depotAcomptes.parDemande(d.id))!;
        await ouverte.confirmerReception(d.id, { montant: dossier.montantAttendu, montantRecuAvant: 0 }, adminId);
      }
      await avecAcompte.confirmer(gagnante.id);
      expect(await codeDe(avecAcompte.confirmer(perdante.id))).toBe("OFFRE_DEJA_CONFIRMEE");

      await avecAcompte.annuler(gagnante.id); // l'offre se libère
      expect(await statutDe(perdante.id)).toBe("acceptee"); // rien ne la confirme à sa place
      expect((await avecAcompte.confirmer(perdante.id)).statut).toBe("confirmee"); // sur geste explicite
    });
  });

  /* ───────────────────── Remontée jusqu'au visiteur (HTTP) ───────────────────── */

  describe("remontée du refus", () => {
    it("la voie du visiteur lève un 409 OFFRE_DEJA_CONFIRMEE", async () => {
      const f = fenetreUnique(4);
      await confirmee(await logement(f));
      const { acompteFerme } = monter();
      const visiteurId = await visiteur();
      const demande = await depotDemandes.creerLogement({ logementId: "l-001", ...f, personnes: 2, visiteurId });
      await acompteFerme.accepterParPartenaire(demande.id);

      let erreur: ErreurMetier | undefined;
      await acompteFerme.confirmerPourVisiteur(demande.id, visiteurId).catch((e) => (erreur = e));
      expect(erreur!.getStatus()).toBe(409);
      expect(erreur!.getResponse()).toEqual({ code: "OFFRE_DEJA_CONFIRMEE", message: expect.stringContaining("déjà confirmée") });
    });
  });
});
