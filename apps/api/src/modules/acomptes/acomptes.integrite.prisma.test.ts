import { randomBytes } from "node:crypto";

import type { StatutAcompte } from "@teranga/contracts";
import { STATUTS_ACOMPTE } from "@teranga/contracts";
import type { Resend } from "resend";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier } from "../../commun/erreurs";
import type { ConfigAcompte } from "../../config/configuration";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotDemandesPrisma } from "../demandes/demandes.prisma";
import { ServiceDemandes } from "../demandes/demandes.service";
import { TRANSITIONS_ACOMPTE } from "./acomptes.depot";
import { DepotAcomptesPrisma } from "./acomptes.prisma";
import { ServiceAcomptes } from "./acomptes.service";
import { fenetreUnique, instantUnique, reserverFenetres } from "../demandes/fenetres-uniques.test-utils";

async function codeDe(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return (erreur.getResponse() as { code: string }).code;
    throw erreur;
  }
  return "AUCUN_REFUS";
}

/** Sentinelles : aucune coordonnée réelle dans ce dépôt. */
const OUVERTE: ConfigAcompte = {
  actif: true,
  pourcentage: 30,
  etatCoordonnees: "defini",
  beneficiaire: {
    titulaire: "TITULAIRE-DE-TEST",
    banque: "BANQUE-DE-TEST",
    iban: "IBANDETESTNEPASUTILISER",
    bic: "BICDETEST",
  },
};

/**
 * Remboursements et garde-fous de la base (base `teranga_test` seule).
 *
 * Un total de 620 000 FCFA à 30 % donne un acompte de 186 000 FCFA.
 */
describe("Acomptes — remboursements et intégrité tenue par la base", () => {
  let prisma: PrismaService;
  let depot: DepotAcomptesPrisma;
  let depotDemandes: DepotDemandesPrisma;
  let adminId: string;
  let autreAdminId: string;
  let send: ReturnType<typeof vi.fn>;

  const suffixe = () => randomBytes(4).toString("hex");

  const monter = () => {
    const email = new ServiceEmail({ emails: { send } } as unknown as Resend);
    const acomptes = new ServiceAcomptes(depot, email, OUVERTE);
    return { acomptes, demandes: new ServiceDemandes(depotDemandes, acomptes) };
  };

  async function visiteur() {
    const id = `visiteur-integ-${suffixe()}`;
    await prisma.account.create({ data: { id, email: `${id}@test.local` } });
    return id;
  }

  /** Une demande acceptée, dossier ouvert. */
  async function dossierPret() {
    const demande = await depotDemandes.creerLogement({
      logementId: "l-001",
      ...fenetreUnique(4),
      personnes: 2,
      visiteurId: await visiteur(),
    });
    const { acomptes, demandes } = monter();
    await demandes.accepterParPartenaire(demande.id);
    const dossier = (await depot.parDemande(demande.id))!;
    send.mockClear();
    return { demande, dossier, acomptes, demandes };
  }

  /** Un acompte payé en totalité. */
  async function dossierPaye() {
    const pret = await dossierPret();
    await pret.acomptes.confirmerReception(pret.demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
    send.mockClear();
    return pret;
  }

  const statutDemande = async (id: string) =>
    (await prisma.demand.findUniqueOrThrow({ where: { id }, select: { statut: true } })).statut;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    await reserverFenetres(prisma);
    depot = new DepotAcomptesPrisma(prisma);
    depotDemandes = new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures());
    adminId = (await prisma.account.create({ data: { email: `admin-integ-${suffixe()}@test.local`, role: "ADMINISTRATEUR" } })).id;
    autreAdminId = (await prisma.account.create({ data: { email: `admin2-integ-${suffixe()}@test.local`, role: "ADMINISTRATEUR" } })).id;
  });

  beforeEach(() => {
    send = vi.fn().mockResolvedValue({ data: { id: "em_test" }, error: null });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /* ───────────────────────────── Remboursements ───────────────────────────── */

  describe("décision de remboursement", () => {
    it("fait passer un acompte payé « à rembourser », sans toucher la demande ni écrire au visiteur", async () => {
      const { demande, dossier, acomptes } = await dossierPaye();

      const apres = await acomptes.deciderRemboursement(demande.id, {
        acteurId: adminId,
        commentaire: "Le propriétaire s'est désisté.",
      });

      expect(apres).toMatchObject({ statut: "a_rembourser", montantRecu: 186_000 });
      const decision = (await depot.journal(dossier.id)).find((e) => e.type === "remboursement_decide")!;
      expect(decision).toMatchObject({
        montant: 186_000,
        acteurId: adminId,
        statutAvant: "paye",
        statutApres: "a_rembourser",
        commentaire: "Le propriétaire s'est désisté.",
      });
      expect(await statutDemande(demande.id)).toBe("acceptee");
      // Aucun e-mail : on ne promet au visiteur ni délai ni montant avant validation.
      expect(send).not.toHaveBeenCalled();
    });

    it("refuse sans motif, hors statuts payé ou partiel, et une seconde fois", async () => {
      const attente = await dossierPret();
      expect(
        await codeDe(attente.acomptes.deciderRemboursement(attente.demande.id, { acteurId: adminId, commentaire: "motif" })),
      ).toBe("ACOMPTE_RIEN_A_REMBOURSER");

      const { demande, acomptes } = await dossierPaye();
      for (const vide of ["", "   "]) {
        expect(await codeDe(acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: vide }))).toBe(
          "ACOMPTE_MOTIF_REQUIS",
        );
      }
      await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" });
      expect(await codeDe(acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" }))).toBe(
        "ACOMPTE_RIEN_A_REMBOURSER",
      );
    });

    it("dix décisions simultanées n'en retiennent qu'une", async () => {
      const { demande, dossier, acomptes } = await dossierPaye();
      const issues = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          acomptes.deciderRemboursement(demande.id, { acteurId: i % 2 ? adminId : autreAdminId, commentaire: "motif" }),
        ),
      );
      expect(issues.filter((i) => i.status === "fulfilled")).toHaveLength(1);
      expect((await depot.journal(dossier.id)).filter((e) => e.type === "remboursement_decide")).toHaveLength(1);
    });

    it("rend un acompte partiel, et plus aucune réception ne s'y enregistre ensuite", async () => {
      const { demande, acomptes } = await dossierPret();
      await acomptes.confirmerReception(
        demande.id,
        { montant: 100_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" },
        adminId,
      );
      const apres = await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "Annulation client" });
      expect(apres).toMatchObject({ statut: "a_rembourser", montantRecu: 100_000 });
      expect(
        await codeDe(acomptes.confirmerReception(demande.id, { montant: 86_000, montantRecuAvant: 100_000 }, adminId)),
      ).toBe("ACOMPTE_NON_ATTENDU");
    });

    it("complète la fin de demande : un acompte payé sur une demande annulée reste à décider, un partiel part tout seul", async () => {
      const payee = await dossierPaye();
      await payee.demandes.annuler(payee.demande.id);
      // Payé : la fin de demande ne rend rien d'office — une personne décide.
      expect((await depot.parDemande(payee.demande.id))!.statut).toBe("paye");
      expect((await payee.acomptes.lireVue(payee.demande.id)).actions.deciderRemboursement).toBe(true);
      await payee.acomptes.deciderRemboursement(payee.demande.id, { acteurId: adminId, commentaire: "Demande annulée" });

      const partielle = await dossierPret();
      await partielle.acomptes.confirmerReception(
        partielle.demande.id,
        { montant: 50_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" },
        adminId,
      );
      await partielle.demandes.annuler(partielle.demande.id);
      expect((await depot.parDemande(partielle.demande.id))!).toMatchObject({ statut: "a_rembourser", montantRecu: 50_000 });
    });
  });

  describe("constat d'un remboursement exécuté hors plateforme", () => {
    async function aRembourser() {
      const pret = await dossierPaye();
      await pret.acomptes.deciderRemboursement(pret.demande.id, { acteurId: adminId, commentaire: "motif" });
      return pret;
    }

    it("consigne le remboursement, passe à « remboursé » (final) et n'appelle rien", async () => {
      const { demande, dossier, acomptes } = await aRembourser();
      const apres = await acomptes.constaterRemboursement(demande.id, {
        acteurId: autreAdminId,
        montant: 186_000,
        referenceTransaction: "REMB-001",
        commentaire: "Viré depuis le compte central",
      });

      expect(apres.statut).toBe("rembourse");
      const effectue = (await depot.journal(dossier.id)).find((e) => e.type === "remboursement_effectue")!;
      expect(effectue).toMatchObject({
        montant: 186_000,
        acteurId: autreAdminId,
        referenceTransaction: "REMB-001",
        statutAvant: "a_rembourser",
        statutApres: "rembourse",
      });
      expect(send).not.toHaveBeenCalled();
      expect(await statutDemande(demande.id)).toBe("acceptee");
    });

    it("exige le montant exact du cumul reçu : pas de remboursement partiel", async () => {
      const { demande, dossier, acomptes } = await aRembourser();
      for (const montant of [1, 100_000, 186_001]) {
        expect(await codeDe(acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant }))).toBe(
          "ACOMPTE_REMBOURSEMENT_MONTANT",
        );
      }
      expect((await depot.parId(dossier.id))!.statut).toBe("a_rembourser");
    });

    it("n'a rien à constater avant la décision, ni après le remboursement", async () => {
      const paye = await dossierPaye();
      expect(
        await codeDe(paye.acomptes.constaterRemboursement(paye.demande.id, { acteurId: adminId, montant: 186_000 })),
      ).toBe("ACOMPTE_NON_A_REMBOURSER");

      const { demande, acomptes } = await aRembourser();
      await acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 });
      expect(await codeDe(acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 }))).toBe(
        "ACOMPTE_NON_A_REMBOURSER",
      );
    });

    it("cinq constats simultanés n'en consignent qu'un", async () => {
      const { demande, dossier, acomptes } = await aRembourser();
      const issues = await Promise.allSettled(
        Array.from({ length: 5 }, () => acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 })),
      );
      expect(issues.filter((i) => i.status === "fulfilled")).toHaveLength(1);
      expect((await depot.journal(dossier.id)).filter((e) => e.type === "remboursement_effectue")).toHaveLength(1);
    });

    it("rend aussi l'argent arrivé après l'échéance", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      await acomptes.deciderPaiementTardif(dossier.id, { issue: "rembourser", acteurId: adminId, commentaire: "Créneau reloué" });
      const apres = await acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 });
      expect(apres.statut).toBe("rembourse");
    });

    it("annonce les bonnes actions à l'écran d'équipe à chaque étape", async () => {
      const { demande, acomptes } = await dossierPaye();
      expect((await acomptes.lireVue(demande.id)).actions).toMatchObject({
        deciderRemboursement: true,
        constaterRemboursement: false,
        confirmerReception: false,
      });
      await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" });
      expect((await acomptes.lireVue(demande.id)).actions).toMatchObject({
        deciderRemboursement: false,
        constaterRemboursement: true,
      });
      await acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 });
      expect((await acomptes.lireVue(demande.id)).actions).toMatchObject({
        deciderRemboursement: false,
        constaterRemboursement: false,
        renvoyerInstructions: false,
      });
    });
  });

  /* ───────── Décision de remboursement contre réceptions concurrentes ───────── */

  describe("la décision de remboursement ne ment jamais sur le montant, même en course", () => {
    const TOURS = 20;
    const partiel = { ecartConfirme: true, commentaire: "partiel" };

    /** Le montant que la décision a inscrit au journal, et celui du dossier. */
    async function lire(acompteId: string) {
      const journal = await depot.journal(acompteId);
      const decision = journal.find(
        (e) => e.type === "remboursement_decide" || (e.type === "annulation" && e.statutApres === "a_rembourser"),
      );
      const dossier = (await depot.parId(acompteId))!;
      return { journal, decision, dossier };
    }

    it("une réception partielle et une décision simultanées : le montant décidé est toujours le cumul final", async () => {
      let receptionPassee = 0;
      let receptionRefusee = 0;
      for (let tour = 0; tour < TOURS; tour++) {
        const { demande, dossier, acomptes } = await dossierPret();
        await acomptes.confirmerReception(demande.id, { montant: 100_000, montantRecuAvant: 0, ...partiel }, adminId);

        const [reception, decision] = await Promise.allSettled([
          acomptes.confirmerReception(demande.id, { montant: 50_000, montantRecuAvant: 100_000, ...partiel }, autreAdminId),
          acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" }),
        ]);

        // La décision aboutit toujours : un partiel est remboursable, que la
        // réception passe avant ou soit refusée après.
        expect(decision.status, `tour ${tour}`).toBe("fulfilled");
        const { journal, decision: evenement, dossier: apres } = await lire(dossier.id);
        expect(apres.statut).toBe("a_rembourser");
        // Le cœur : ce que la décision a inscrit est ce que le dossier contient.
        expect(evenement!.montant, `tour ${tour}`).toBe(apres.montantRecu);

        if (reception.status === "fulfilled") {
          receptionPassee++;
          expect(apres.montantRecu).toBe(150_000);
          // Elle précède la décision au journal.
          expect(journal.findIndex((e) => e.type === "reception_confirmee" && e.montant === 50_000)).toBeLessThan(
            journal.findIndex((e) => e.type === "remboursement_decide"),
          );
        } else {
          receptionRefusee++;
          expect((reception.reason as ErreurMetier).getResponse()).toMatchObject({
            code: expect.stringMatching(/ACOMPTE_NON_ATTENDU|ACOMPTE_STATUT_CONCURRENT|ACOMPTE_CUMUL_CONCURRENT/),
          });
          expect(apres.montantRecu).toBe(100_000);
        }
        // Et le remboursement se clôt sur ce montant exact, jamais sur un autre.
        await acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: apres.montantRecu });
      }
      // Les deux issues ont lieu : le test éprouve bien une course, pas un ordre fixe.
      expect(receptionPassee + receptionRefusee).toBe(TOURS);
    });

    it("plusieurs réceptions partielles et une décision : aucune réception n'est comptée après la décision", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      await acomptes.confirmerReception(demande.id, { montant: 20_000, montantRecuAvant: 0, ...partiel }, adminId);

      // Sept administrateurs tentent le même complément, un huitième décide.
      const issues = await Promise.allSettled([
        ...Array.from({ length: 7 }, (_, i) =>
          acomptes.confirmerReception(demande.id, { montant: 10_000, montantRecuAvant: 20_000, ...partiel }, i % 2 ? adminId : autreAdminId),
        ),
        acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" }),
      ]);
      expect(issues.at(-1)!.status).toBe("fulfilled");
      const { journal, decision, dossier: apres } = await lire(dossier.id);
      // Au plus une réception du complément a pu passer (cumul lu = 20 000).
      const receptions = journal.filter((e) => e.type === "reception_confirmee");
      expect(receptions.length).toBeLessThanOrEqual(2);
      expect(decision!.montant).toBe(apres.montantRecu);
      const somme = receptions.reduce((total, e) => total + (e.montant ?? 0), 0);
      expect(somme).toBe(apres.montantRecu);
    });

    it("un paiement tardif et le refus de ce paiement simultanés : le montant rendu est le cumul final", async () => {
      for (let tour = 0; tour < 10; tour++) {
        const { demande, dossier, acomptes } = await dossierPret();
        await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
        await acomptes.confirmerReception(demande.id, { montant: 100_000, montantRecuAvant: 0, ...partiel }, adminId);

        const [, refus] = await Promise.allSettled([
          acomptes.confirmerReception(demande.id, { montant: 86_000, montantRecuAvant: 100_000 }, autreAdminId),
          acomptes.deciderPaiementTardif(dossier.id, { issue: "rembourser", acteurId: adminId, commentaire: "créneau reloué" }),
        ]);
        expect(refus.status).toBe("fulfilled");
        const { decision, dossier: apres } = await lire(dossier.id);
        expect(apres.statut).toBe("a_rembourser");
        expect(decision!.montant, `tour ${tour}`).toBe(apres.montantRecu);
      }
    });

    it("la fin de la demande et une réception simultanées ne laissent jamais d'argent sur une demande morte sans issue", async () => {
      for (let tour = 0; tour < TOURS; tour++) {
        const exact = tour % 2 === 0;
        const { demande, dossier, acomptes, demandes } = await dossierPret();
        const saisie = exact
          ? { montant: 186_000, montantRecuAvant: 0 }
          : { montant: 50_000, montantRecuAvant: 0, ...partiel };

        await Promise.allSettled([
          acomptes.confirmerReception(demande.id, saisie, adminId),
          demandes.annuler(demande.id),
        ]);

        expect(await statutDemande(demande.id)).toBe("annulee");
        const apres = (await depot.parId(dossier.id))!;
        const vue = await acomptes.lireVue(demande.id);
        // Jamais de statut qui attend encore un paiement sur une demande close.
        expect(["en_attente", "partiel"], `tour ${tour}`).not.toContain(apres.statut);
        if (apres.montantRecu === 0) {
          expect(apres.statut).toBe("annule");
        } else if (exact) {
          // Payé en totalité avant l'annulation : une personne décide du remboursement.
          expect(apres.statut).toBe("paye");
          expect(vue.actions.deciderRemboursement).toBe(true);
        } else {
          // Un partiel part tout seul « à rembourser ».
          expect(apres.statut).toBe("a_rembourser");
          expect(vue.actions.constaterRemboursement).toBe(true);
        }
      }
    });
  });

  /* ─────────── Pas de confirmation sans acompte payé et vérifié ─────────── */

  describe("la confirmation exige un acompte vérifié, sans jamais se déclencher d'elle-même", () => {
    const FERMEE: ConfigAcompte = { actif: false, pourcentage: undefined, etatCoordonnees: "absent", beneficiaire: undefined };

    it("refuse de confirmer tant que rien n'est payé, ou que le paiement est partiel", async () => {
      const { demande, dossier, acomptes, demandes } = await dossierPret();
      expect(await codeDe(demandes.confirmer(demande.id))).toBe("ACOMPTE_NON_PAYE");
      expect(await statutDemande(demande.id)).toBe("acceptee");

      await acomptes.confirmerReception(
        demande.id,
        { montant: 100_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" },
        adminId,
      );
      expect(await codeDe(demandes.confirmer(demande.id))).toBe("ACOMPTE_NON_PAYE");
      expect(await statutDemande(demande.id)).toBe("acceptee");
      expect((await depot.parId(dossier.id))!.statut).toBe("partiel");
    });

    it("laisse confirmer une fois le paiement vérifié — et le paiement seul ne confirme rien", async () => {
      const { demande, acomptes, demandes } = await dossierPret();
      await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);

      // Payé et vérifié : la demande reste « acceptée », c'est le visiteur qui confirme.
      expect(await statutDemande(demande.id)).toBe("acceptee");
      const confirmee = await demandes.confirmer(demande.id);
      expect(confirmee.statut).toBe("confirmee");
      expect((await acomptes.lireVue(demande.id)).acompte!.statut).toBe("paye");
    });

    it("refuse de nouveau si le remboursement a été décidé entre-temps", async () => {
      const { demande, acomptes, demandes } = await dossierPret();
      await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "désistement" });
      expect(await codeDe(demandes.confirmer(demande.id))).toBe("ACOMPTE_NON_PAYE");
      expect(await statutDemande(demande.id)).toBe("acceptee");
    });

    it("ne gêne ni un genre sans acompte, ni une demande acceptée acompte fermé", async () => {
      // Un taxi n'a pas de dossier : rien n'est exigé.
      const { acomptes, demandes } = monter();
      const taxi = await depotDemandes.creerVehicule({
        vehiculeId: "v-001", prestation: "taxi", depart: "Dakar", arrivee: "Saly",
        quand: instantUnique("09:00"), passagers: 2, bagages: 0, visiteurId: await visiteur(),
      });
      await demandes.accepterParPartenaire(taxi.id);
      expect(await depot.parDemande(taxi.id)).toBeNull();
      expect((await demandes.confirmer(taxi.id)).statut).toBe("confirmee");
      void acomptes;

      // Acompte fermé à l'acceptation : pas de dossier, la confirmation fonctionne comme avant.
      const email = new ServiceEmail({ emails: { send } } as unknown as Resend);
      const fermee = new ServiceAcomptes(depot, email, FERMEE);
      const demandesFermees = new ServiceDemandes(depotDemandes, fermee);
      const logement = await depotDemandes.creerLogement({
        logementId: "l-001", ...fenetreUnique(4), personnes: 2, visiteurId: await visiteur(),
      });
      await demandesFermees.accepterParPartenaire(logement.id);
      expect(await depot.parDemande(logement.id)).toBeNull();
      expect((await demandesFermees.confirmer(logement.id)).statut).toBe("confirmee");
    });

    it("un paiement et une confirmation simultanés : jamais confirmée avec un acompte non vérifié", async () => {
      let confirmees = 0;
      let refusees = 0;
      for (let tour = 0; tour < 15; tour++) {
        const { demande, dossier, acomptes, demandes } = await dossierPret();
        const [, confirmation] = await Promise.allSettled([
          acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId),
          demandes.confirmer(demande.id),
        ]);
        const apres = (await depot.parId(dossier.id))!;
        if (confirmation.status === "fulfilled") {
          confirmees++;
          // Confirmée ⇒ le paiement avait été vérifié avant.
          expect(apres.statut, `tour ${tour}`).toBe("paye");
          expect(await statutDemande(demande.id)).toBe("confirmee");
        } else {
          refusees++;
          expect((confirmation.reason as ErreurMetier).getResponse()).toMatchObject({ code: "ACOMPTE_NON_PAYE" });
          expect(await statutDemande(demande.id)).toBe("acceptee");
        }
      }
      expect(confirmees + refusees).toBe(15);
    });
  });

  /* ─────── Confirmation et remboursement : un seul verrou, aucun entre-deux ─────── */

  describe("la confirmation attend le verrou d'un remboursement en cours", () => {
    /** La demande telle que `transitionner` l'écrirait pour une confirmation. */
    async function confirmationDe(demandeId: string) {
      const courante = (await depotDemandes.parId(demandeId))!;
      return {
        ...courante,
        statut: "confirmee" as const,
        expireLe: undefined,
        frise: [...courante.frise, { statut: "confirmee" as const, horodatage: new Date().toISOString(), origine: "visiteur" as const }],
      };
    }

    it("refuse d'écrire la confirmation si le remboursement a été décidé après le contrôle du service", async () => {
      const { demande, acomptes } = await dossierPaye();
      const confirmee = await confirmationDe(demande.id);

      // Le service a contrôlé (payé) ; puis une décision de remboursement passe ; puis l'écriture.
      await expect(acomptes.exigerPaiementVerifie(demande.id)).resolves.toBeUndefined();
      await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "désistement" });

      expect(await codeDe(depotDemandes.enregistrer(confirmee, "acceptee"))).toBe("ACOMPTE_NON_PAYE");
      expect(await statutDemande(demande.id)).toBe("acceptee");
    });

    it("écrit la confirmation quand l'acompte est payé", async () => {
      const { demande } = await dossierPaye();
      const apres = await depotDemandes.enregistrer(await confirmationDe(demande.id), "acceptee");
      expect(apres.statut).toBe("confirmee");
    });

    it("attend réellement le verrou : une décision en cours bloque la confirmation, qui échoue ensuite", async () => {
      const { demande, dossier } = await dossierPaye();
      const confirmee = await confirmationDe(demande.id);

      let terminee = false;
      let ecriture: Promise<unknown> | undefined;

      await prisma.$transaction(async (tx) => {
        // Une décision de remboursement, en cours : le dossier est verrouillé, rien n'est commité.
        await tx.$queryRaw`SELECT 1 FROM "deposit_payments" WHERE "id" = ${dossier.id} FOR UPDATE`;
        await tx.depositPayment.update({ where: { id: dossier.id }, data: { statut: "a_rembourser" } });
        await tx.depositPaymentEvent.create({
          data: {
            acompteId: dossier.id, type: "remboursement_decide", montant: 186_000, acteurId: adminId,
            commentaire: "motif", statutAvant: "paye", statutApres: "a_rembourser",
          },
        });

        // La confirmation démarre pendant ce temps. Sans `FOR SHARE`, elle verrait « payé »
        // (le changement n'est pas commité) et se terminerait tout de suite.
        ecriture = depotDemandes.enregistrer(confirmee, "acceptee");
        ecriture.then(() => (terminee = true), () => (terminee = true));
        await new Promise((resume) => setTimeout(resume, 400));
        expect(terminee, "la confirmation aurait dû attendre le verrou").toBe(false);
      });

      // Le remboursement est commité : la confirmation relit, voit « à rembourser », et refuse.
      await expect(ecriture!).rejects.toMatchObject({ response: { code: "ACOMPTE_NON_PAYE" } });
      expect(await statutDemande(demande.id)).toBe("acceptee");
    });

    it("confirmation et remboursement simultanés : jamais de blocage, une seule issue cohérente", async () => {
      for (let tour = 0; tour < 20; tour++) {
        const { demande, dossier, acomptes, demandes } = await dossierPaye();
        const [confirmation, remboursement] = await Promise.allSettled([
          demandes.confirmer(demande.id),
          acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" }),
        ]);

        // La décision aboutit toujours : confirmée ou non, un acompte payé est remboursable.
        expect(remboursement.status, `tour ${tour}`).toBe("fulfilled");
        expect((await depot.parId(dossier.id))!.statut).toBe("a_rembourser");

        if (confirmation.status === "fulfilled") {
          expect(await statutDemande(demande.id)).toBe("confirmee");
        } else {
          expect((confirmation.reason as ErreurMetier).getResponse()).toMatchObject({ code: "ACOMPTE_NON_PAYE" });
          expect(await statutDemande(demande.id)).toBe("acceptee");
        }
      }
    });
  });

  /* ───────────────── `consigner` ne déplace ni argent ni statut ───────────────── */

  describe("consigner n'écrit qu'une ligne de journal", () => {
    it("refuse les événements qui changeraient le cumul ou le statut, sans rien écrire", async () => {
      const { dossier } = await dossierPret();
      const avant = { journal: (await depot.journal(dossier.id)).length, dossier: (await depot.parId(dossier.id))! };

      for (const evenement of [
        { type: "reception_confirmee" as const, montant: 186_000, acteurId: adminId },
        { type: "remboursement_decide" as const, montant: 186_000, acteurId: adminId },
        { type: "remboursement_effectue" as const, montant: 186_000, acteurId: adminId },
        { type: "expiration_prononcee" as const },
        { type: "annulation" as const },
        { type: "preparation" as const },
      ]) {
        expect(await codeDe(depot.consigner(dossier.id, evenement)), evenement.type).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      }

      const apres = (await depot.parId(dossier.id))!;
      expect(apres).toMatchObject({ statut: avant.dossier.statut, montantRecu: avant.dossier.montantRecu });
      expect(await depot.journal(dossier.id)).toHaveLength(avant.journal);
    });

    it("accepte les notes de journal, et le cumul ne bouge pas même avec un montant", async () => {
      const { dossier } = await dossierPaye();
      for (const evenement of [
        { type: "rappel_envoye" as const },
        { type: "preuve_declaree" as const, montant: 186_000, commentaire: "capture reçue" },
        { type: "doublon_signale" as const, montant: 186_000, acteurId: adminId },
        { type: "anomalie_signalee" as const, montant: 5, acteurId: adminId, commentaire: "écart" },
        { type: "verification" as const, acteurId: adminId, commentaire: "relevé consulté" },
        { type: "envoi_echoue" as const, commentaire: "Resend indisponible" },
      ]) {
        await expect(depot.consigner(dossier.id, evenement), evenement.type).resolves.toBeTruthy();
      }
      expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "paye", montantRecu: 186_000 });
    });
  });

  /* ───────────────── Garde-fous de la base, hors du dépôt ───────────────── */

  describe("la base refuse ce que le dépôt ne laisserait pas passer", () => {
    // Écritures directes par Prisma : elles contournent le dépôt, comme un script.
    it("refuse « payé » sans le compte, « partiel » hors bornes, « en attente » ou « annulé » avec de l'argent", async () => {
      const { dossier } = await dossierPret();
      const ecrire = (data: object) => prisma.depositPayment.update({ where: { id: dossier.id }, data });

      await expect(ecrire({ statut: "paye", montantRecu: 185_999 })).rejects.toThrow(/deposit_payments_paye_check/);
      await expect(ecrire({ statut: "partiel", montantRecu: 0 })).rejects.toThrow(/deposit_payments_partiel_check/);
      await expect(ecrire({ statut: "partiel", montantRecu: 186_000 })).rejects.toThrow(/deposit_payments_partiel_check/);
      await expect(ecrire({ montantRecu: 1 })).rejects.toThrow(/deposit_payments_en_attente_check/);
      await expect(ecrire({ statut: "annule", montantRecu: 1 })).rejects.toThrow(/deposit_payments_annule_check/);
      expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "en_attente", montantRecu: 0 });
    });

    it("fige la demande, le taux et les montants annoncés", async () => {
      const { dossier } = await dossierPret();
      const autre = await dossierPret();
      const ecrire = (data: object) => prisma.depositPayment.update({ where: { id: dossier.id }, data });

      await expect(ecrire({ montantAttendu: 100 })).rejects.toThrow(/figés à la préparation/);
      await expect(ecrire({ montantTotal: 700_000 })).rejects.toThrow(/figés à la préparation/);
      await expect(ecrire({ pourcentageApplique: 50 })).rejects.toThrow(/figés à la préparation/);
      await expect(ecrire({ demandeId: autre.demande.id })).rejects.toThrow(/figés à la préparation|Unique constraint/);
      expect((await depot.parId(dossier.id))!).toMatchObject({ montantAttendu: 186_000, montantTotal: 620_000, pourcentageApplique: 30 });
    });

    it("ne laisse jamais baisser le montant reçu", async () => {
      const { dossier } = await dossierPaye();
      await expect(prisma.depositPayment.update({ where: { id: dossier.id }, data: { montantRecu: 100_000 } })).rejects.toThrow(
        /ne diminue pas/,
      );
      expect((await depot.parId(dossier.id))!.montantRecu).toBe(186_000);
    });

    it("garde « remboursé » final et refuse de rouvrir un remboursement", async () => {
      const { demande, dossier, acomptes } = await dossierPaye();
      await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" });
      await acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 });

      for (const vers of ["paye", "a_rembourser", "en_attente", "expire"] as const) {
        await expect(prisma.depositPayment.update({ where: { id: dossier.id }, data: { statut: vers } })).rejects.toThrow(
          /passage de rembourse à .* interdit/,
        );
      }
    });

    it("n'annule pas de l'argent reçu, et ne rouvre pas un acompte annulé", async () => {
      const partielle = await dossierPret();
      await partielle.acomptes.confirmerReception(
        partielle.demande.id,
        { montant: 50_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" },
        adminId,
      );
      await expect(
        prisma.depositPayment.update({ where: { id: partielle.dossier.id }, data: { statut: "annule" } }),
      ).rejects.toThrow(/passage de partiel à annule interdit/);

      const annulee = await dossierPret();
      await annulee.acomptes.synchroniserFinDeDemande(annulee.demande.id, "annulee");
      expect((await depot.parId(annulee.dossier.id))!.statut).toBe("annule");
      for (const vers of ["a_rembourser", "paye", "partiel", "en_attente"] as const) {
        await expect(
          prisma.depositPayment.update({ where: { id: annulee.dossier.id }, data: { statut: vers } }),
        ).rejects.toThrow(/passage de annule à .* interdit/);
      }
    });

    it("exige une personne et un montant pour une réception, une vérification ou un remboursement", async () => {
      const { dossier } = await dossierPret();
      const creer = (data: object) =>
        prisma.depositPaymentEvent.create({ data: { acompteId: dossier.id, ...data } as never });

      await expect(creer({ type: "reception_confirmee", montant: 1000 })).rejects.toThrow(/acteur_requis_check/);
      await expect(creer({ type: "reception_confirmee", acteurId: adminId })).rejects.toThrow(/montant_requis_check/);
      await expect(creer({ type: "verification" })).rejects.toThrow(/acteur_requis_check/);
      await expect(creer({ type: "remboursement_decide", acteurId: adminId })).rejects.toThrow(/montant_requis_check/);
      await expect(creer({ type: "remboursement_effectue", montant: 1000 })).rejects.toThrow(/acteur_requis_check/);
      // Les événements du système restent possibles : une préparation, un rappel, un échec d'envoi.
      await expect(creer({ type: "rappel_envoye" })).resolves.toBeTruthy();
    });

    it("ne supprime ni ne modifie le journal, et ne supprime pas un dossier qui en a un", async () => {
      const { dossier } = await dossierPaye();
      const [premier] = await depot.journal(dossier.id);
      await expect(prisma.depositPaymentEvent.update({ where: { id: premier.id }, data: { commentaire: "x" } })).rejects.toThrow(/append-only/);
      await expect(prisma.depositPaymentEvent.delete({ where: { id: premier.id } })).rejects.toThrow(/append-only/);
      await expect(prisma.depositPayment.delete({ where: { id: dossier.id } })).rejects.toThrow();
      expect(await prisma.depositPayment.findUnique({ where: { id: dossier.id } })).not.toBeNull();
    });

    it("refuse en erreur métier — et non en erreur brute — un événement sans personne ou sans montant", async () => {
      const { dossier } = await dossierPret();
      const avant = (await depot.journal(dossier.id)).length;
      for (const evenement of [
        { type: "verification" as const },
        { type: "remboursement_decide" as const, acteurId: adminId },
        { type: "remboursement_decide" as const, montant: 1000 },
        { type: "remboursement_effectue" as const, montant: 1000 },
        { type: "reception_confirmee" as const, acteurId: adminId },
      ]) {
        expect(await codeDe(depot.consigner(dossier.id, evenement)), JSON.stringify(evenement)).toBe(
          "ACOMPTE_EVENEMENT_INVALIDE",
        );
      }
      expect(await depot.journal(dossier.id)).toHaveLength(avant);
    });

    it("n'accepte la décision de remboursement que d'une personne nommée", async () => {
      const { dossier } = await dossierPaye();
      expect(
        await codeDe(
          depot.declarerARembourser({
            acompteId: dossier.id,
            depuisStatuts: ["paye"],
            type: "remboursement_decide",
            commentaire: "motif",
          }),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect((await depot.parId(dossier.id))!.statut).toBe("paye");
    });

    it("traduit un refus de la base en erreur métier quand le dépôt est pris en défaut", async () => {
      const { dossier } = await dossierPret();
      const avant = (await depot.journal(dossier.id)).length;
      // Une transition que la table du dépôt permet, mais dont les montants mentent.
      expect(
        await codeDe(
          depot.changerStatut(
            dossier.id,
            { de: "en_attente", vers: "paye" },
            { type: "reception_confirmee", montant: 1, acteurId: adminId },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "en_attente", montantRecu: 0 });
      expect(await depot.journal(dossier.id)).toHaveLength(avant);
    });
  });

  /**
   * La table des transitions existe deux fois : dans le dépôt
   * (`TRANSITIONS_ACOMPTE`) et dans le déclencheur SQL. Ce test les compare sur
   * les 42 changements de statut possibles, pour qu'elles ne divergent jamais.
   */
  describe("la table SQL des transitions est celle du dépôt", () => {
    const CUMUL_INITIAL: Record<StatutAcompte, number> = {
      en_attente: 0, partiel: 100, paye: 300, expire: 0, annule: 0, a_rembourser: 300, rembourse: 300,
    };
    const cumulCible = (vers: StatutAcompte, courant: number) => {
      if (vers === "paye") return 300;
      if (vers === "partiel") return Math.max(courant, 100);
      return courant; // jamais de baisse : ce n'est pas ce que ce test éprouve
    };

    /**
     * L'événement qui explique un statut, tel que le workflow l'écrit : sans lui, la
     * base annule la transaction (voir « le journal explique toujours le statut »).
     */
    const evenementDe = (acompteId: string, statut: StatutAcompte, avant?: StatutAcompte) => {
      const base = { acompteId, statutAvant: avant ?? null, statutApres: statut };
      switch (statut) {
        case "partiel": return { ...base, type: "reception_confirmee" as const, montant: 100, acteurId: adminId };
        case "paye": return { ...base, type: "reception_confirmee" as const, montant: 300, acteurId: adminId };
        case "expire": return { ...base, type: "expiration_prononcee" as const };
        case "annule": return { ...base, type: "annulation" as const };
        case "a_rembourser": return { ...base, type: "remboursement_decide" as const, montant: 300, acteurId: adminId };
        case "rembourse": return { ...base, type: "remboursement_effectue" as const, montant: 300, acteurId: adminId };
        default: return undefined;
      }
    };

    /** Un dossier posé directement dans l'état voulu, avec l'événement qui l'explique. */
    async function dossierDans(de: StatutAcompte) {
      const demande = await depotDemandes.creerLogement({
        logementId: "l-001", ...fenetreUnique(4), personnes: 1, visiteurId: await visiteur(),
      });
      const id = `acompte-matrice-${suffixe()}`;
      const ecritures: Array<ReturnType<typeof prisma.depositPayment.create> | ReturnType<typeof prisma.depositPaymentEvent.create>> = [
        prisma.depositPayment.create({
          data: {
            id, demandeId: demande.id, statut: de, pourcentageApplique: 30, montantTotal: 1000, montantAttendu: 300,
            montantRecu: CUMUL_INITIAL[de], echeanceLe: new Date(Date.now() + 3_600_000),
          },
        }),
      ];
      const evenement = evenementDe(id, de);
      if (evenement) ecritures.push(prisma.depositPaymentEvent.create({ data: evenement }));
      await prisma.$transaction(ecritures as never);
      return id;
    }

    /** Un changement de statut, écrit avec son événement dans la même transaction. */
    const transiter = (id: string, de: StatutAcompte, vers: StatutAcompte, cumul: number) => {
      const ecritures: unknown[] = [
        prisma.depositPayment.update({ where: { id }, data: { statut: vers, montantRecu: cumul } }),
      ];
      const evenement = evenementDe(id, vers, de);
      if (evenement) ecritures.push(prisma.depositPaymentEvent.create({ data: evenement }));
      return prisma.$transaction(ecritures as never);
    };

    const paires = STATUTS_ACOMPTE.flatMap((de) => STATUTS_ACOMPTE.filter((vers) => vers !== de).map((vers) => [de, vers] as const));

    it("couvre toutes les paires (42)", () => {
      expect(paires).toHaveLength(42);
    });

    it.each(paires)("%s → %s", async (de, vers) => {
      const id = await dossierDans(de);
      const autorise = (TRANSITIONS_ACOMPTE[de] as readonly string[]).includes(vers);
      const essai = transiter(id, de, vers, cumulCible(vers, CUMUL_INITIAL[de]));

      if (!autorise) {
        await expect(essai).rejects.toThrow(/passage de .* interdit/);
      } else {
        // Permis par la table : la base ne le refuse pas au titre de la transition.
        // Une contrainte de montant peut encore le refuser, mais jamais pour
        // « passage interdit ».
        await essai.then(
          () => undefined,
          (erreur: Error) => expect(erreur.message).not.toMatch(/passage de .* interdit/),
        );
      }
    });

    it("laisse passer les transitions réelles du workflow", async () => {
      const reel: Array<[StatutAcompte, StatutAcompte]> = [
        ["en_attente", "partiel"], ["en_attente", "paye"], ["en_attente", "expire"], ["en_attente", "annule"],
        ["partiel", "paye"], ["partiel", "expire"], ["partiel", "a_rembourser"],
        ["paye", "a_rembourser"], ["expire", "paye"], ["expire", "a_rembourser"], ["a_rembourser", "rembourse"],
      ];
      for (const [de, vers] of reel) {
        const id = await dossierDans(de);
        // `expire → payé` suppose que l'argent est déjà reçu en totalité.
        if (de === "expire" && vers === "paye") {
          await prisma.depositPayment.update({ where: { id }, data: { montantRecu: 300 } });
        }
        const initial = de === "expire" && vers === "paye" ? 300 : CUMUL_INITIAL[de];
        await expect(transiter(id, de, vers, cumulCible(vers, initial)), `${de} → ${vers}`).resolves.toBeTruthy();
      }
    });
  });

  /* ───────── Le journal explique toujours le statut (migration 3) ───────── */

  describe("le journal explique toujours le statut", () => {
    it("annule la transaction quand un statut est posé sans son événement", async () => {
      const { dossier } = await dossierPret();
      // « Payé » écrit seul, sans que personne n'ait constaté quoi que ce soit.
      await expect(
        prisma.depositPayment.update({ where: { id: dossier.id }, data: { statut: "paye", montantRecu: 186_000 } }),
      ).rejects.toThrow(/n'a pas son événement de journal/);
      expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "en_attente", montantRecu: 0 });
    });

    it("refuse l'événement d'un autre statut, ou d'un autre type", async () => {
      const { dossier } = await dossierPret();
      // Un événement qui annonce « partiel » n'explique pas « payé ».
      await expect(
        prisma.$transaction([
          prisma.depositPayment.update({ where: { id: dossier.id }, data: { statut: "paye", montantRecu: 186_000 } }),
          prisma.depositPaymentEvent.create({
            data: { acompteId: dossier.id, type: "reception_confirmee", montant: 186_000, acteurId: adminId, statutApres: "partiel" },
          }),
        ]),
      ).rejects.toThrow(/n'a pas son événement de journal/);

      // Un événement d'un type étranger (un simple rappel) n'explique rien non plus.
      await expect(
        prisma.$transaction([
          prisma.depositPayment.update({ where: { id: dossier.id }, data: { statut: "paye", montantRecu: 186_000 } }),
          prisma.depositPaymentEvent.create({ data: { acompteId: dossier.id, type: "rappel_envoye", statutApres: "paye" } }),
        ]),
      ).rejects.toThrow(/n'a pas son événement de journal/);
      expect((await depot.parId(dossier.id))!.statut).toBe("en_attente");
    });

    it("accepte l'événement en n'importe quel ordre dans la transaction", async () => {
      const { dossier } = await dossierPret();
      // L'événement avant le statut : la vérification est différée à la fin de la transaction.
      await prisma.$transaction([
        prisma.depositPaymentEvent.create({
          data: {
            acompteId: dossier.id, type: "reception_confirmee", montant: 186_000, acteurId: adminId,
            statutAvant: "en_attente", statutApres: "paye",
          },
        }),
        prisma.depositPayment.update({ where: { id: dossier.id }, data: { statut: "paye", montantRecu: 186_000 } }),
      ]);
      expect((await depot.parId(dossier.id))!.statut).toBe("paye");
    });

    it("refuse un dossier inséré directement dans un état qui n'est pas le premier", async () => {
      const demande = await depotDemandes.creerLogement({
        logementId: "l-001", ...fenetreUnique(4), personnes: 1, visiteurId: await visiteur(),
      });
      await expect(
        prisma.depositPayment.create({
          data: {
            demandeId: demande.id, statut: "paye", pourcentageApplique: 30, montantTotal: 1000, montantAttendu: 300,
            montantRecu: 300, echeanceLe: new Date(Date.now() + 3_600_000),
          },
        }),
      ).rejects.toThrow(/n'a pas son événement de journal/);
      expect(await depot.parDemande(demande.id)).toBeNull();
    });

    it("n'empêche pas une réception de plus sur un acompte partiel ou expiré", async () => {
      const { demande, acomptes } = await dossierPret();
      await acomptes.confirmerReception(
        demande.id, { montant: 50_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" }, adminId,
      );
      await expect(
        acomptes.confirmerReception(
          demande.id, { montant: 20_000, montantRecuAvant: 50_000, ecartConfirme: true, commentaire: "encore" }, adminId,
        ),
      ).resolves.toBeTruthy();
    });

    it("les chemins du workflow écrivent toujours leur événement (aucun refus du déclencheur)", async () => {
      // Parcours complet par le service : préparation, partiel, paiement, remboursement.
      const { demande, acomptes } = await dossierPret();
      await acomptes.confirmerReception(
        demande.id, { montant: 100_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" }, adminId,
      );
      await acomptes.confirmerReception(demande.id, { montant: 86_000, montantRecuAvant: 100_000 }, adminId);
      await acomptes.deciderRemboursement(demande.id, { acteurId: adminId, commentaire: "motif" });
      await acomptes.constaterRemboursement(demande.id, { acteurId: adminId, montant: 186_000 });
      expect((await acomptes.lireVue(demande.id)).acompte!.statut).toBe("rembourse");
    });
  });
});
