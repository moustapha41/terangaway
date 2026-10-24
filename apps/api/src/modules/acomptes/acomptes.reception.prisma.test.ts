import { randomBytes } from "node:crypto";

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
import { DepotAcomptesPrisma } from "./acomptes.prisma";
import { ServiceAcomptes } from "./acomptes.service";

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
  moyens: ["virement", "wave"],
  mobileMoney: [{ operateur: "wave", numero: "+221000000000", titulaire: "TITULAIRE-WAVE-DE-TEST" }],
  instructions: "Indiquez la référence en message.",
};

/**
 * Constat d'une réception, sur PostgreSQL (base `teranga_test` seule).
 *
 * Un total de 620 000 FCFA à 30 % donne un acompte de 186 000 FCFA.
 */
describe("Acompte — constat manuel d'une réception", () => {
  let prisma: PrismaService;
  let depot: DepotAcomptesPrisma;
  let depotDemandes: DepotDemandesPrisma;
  let adminId: string;
  let autreAdminId: string;
  let send: ReturnType<typeof vi.fn>;

  const suffixe = () => randomBytes(4).toString("hex");

  const monter = (configAcompte: ConfigAcompte = OUVERTE) => {
    const email = new ServiceEmail({ emails: { send } } as unknown as Resend);
    const acomptes = new ServiceAcomptes(depot, email, configAcompte);
    return { acomptes, demandes: new ServiceDemandes(depotDemandes, acomptes) };
  };

  /** Une demande de logement **acceptée**, dossier ouvert, instructions parties. */
  async function dossierPret(avecEmail = true) {
    const id = `visiteur-recep-${suffixe()}`;
    await prisma.account.create({ data: { id, email: avecEmail ? `${id}@test.local` : null } });
    const demande = await depotDemandes.creerLogement({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-14",
      personnes: 2,
      visiteurId: id,
    });
    const { acomptes, demandes } = monter();
    await demandes.accepterParPartenaire(demande.id);
    const dossier = (await depot.parDemande(demande.id))!;
    send.mockClear();
    return { demande, dossier, acomptes };
  }

  const statutDemande = async (id: string) =>
    (await prisma.demand.findUniqueOrThrow({ where: { id }, select: { statut: true } })).statut;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotAcomptesPrisma(prisma);
    depotDemandes = new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures());
    adminId = (await prisma.account.create({ data: { email: `admin-recep-${suffixe()}@test.local`, role: "ADMINISTRATEUR", nom: "Aminata Admin" } })).id;
    autreAdminId = (await prisma.account.create({ data: { email: `admin2-recep-${suffixe()}@test.local`, role: "ADMINISTRATEUR" } })).id;
  });

  beforeEach(() => {
    send = vi.fn().mockResolvedValue({ data: { id: "em_test" }, error: null });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("montant exact", () => {
    it("passe l'acompte à « payé », journalise l'acteur, et laisse la demande « acceptée »", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      expect(dossier.montantAttendu).toBe(186_000);

      const res = await acomptes.confirmerReception(
        demande.id,
        { montant: 186_000, montantRecuAvant: 0, referenceTransaction: "TX-001" },
        adminId,
      );

      expect(res.sens).toBe("exact");
      expect(res.ecart).toBe(0);
      expect(res.acompte).toMatchObject({ statut: "paye", montantRecu: 186_000, confirmeParId: adminId });
      // Distinct de la réservation : le paiement ne confirme pas la demande.
      expect(await statutDemande(demande.id)).toBe("acceptee");

      const journal = await depot.journal(dossier.id);
      const reception = journal.find((e) => e.type === "reception_confirmee")!;
      expect(reception).toMatchObject({
        montant: 186_000,
        acteurId: adminId,
        referenceTransaction: "TX-001",
        statutAvant: "en_attente",
        statutApres: "paye",
      });
      expect(journal.some((e) => e.type === "anomalie_signalee")).toBe(false);
    });

    it("envoie l'e-mail de réception avec le vrai statut de la réservation", async () => {
      const { demande, acomptes } = await dossierPret();
      const res = await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);

      expect(res.emailConfirmation).toBe("envoye");
      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0][0];
      expect(mail.text).toContain("186 000 FCFA");
      expect(mail.text).toContain("434 000 FCFA"); // solde du séjour
      expect(mail.text).toContain("acceptée par le propriétaire, pas encore confirmée");
      expect(mail.text).toContain("ne vaut pas, à elle seule, confirmation");
      expect(mail.text).not.toMatch(/réservation (est )?confirmée\b/i);
    });
  });

  describe("montant inférieur : paiement partiel", () => {
    it("exige la reconnaissance de l'écart et un commentaire", async () => {
      const { demande, dossier, acomptes } = await dossierPret();

      for (const saisie of [
        { montant: 100_000, montantRecuAvant: 0 },
        { montant: 100_000, montantRecuAvant: 0, ecartConfirme: true },
        { montant: 100_000, montantRecuAvant: 0, commentaire: "virement partiel" },
      ]) {
        expect(await codeDe(acomptes.confirmerReception(demande.id, saisie, adminId))).toBe(
          "ACOMPTE_ECART_A_CONFIRMER",
        );
      }
      expect((await depot.parId(dossier.id))!.montantRecu).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });

    it("enregistre « partiel », laisse la demande non confirmée, puis se complète sans doublon", async () => {
      const { demande, dossier, acomptes } = await dossierPret();

      const premiere = await acomptes.confirmerReception(
        demande.id,
        { montant: 100_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "Premier virement reçu seul" },
        adminId,
      );
      expect(premiere.sens).toBe("inferieur");
      expect(premiere.ecart).toBe(-86_000);
      expect(premiere.acompte).toMatchObject({ statut: "partiel", montantRecu: 100_000 });
      expect(await statutDemande(demande.id)).toBe("acceptee");
      expect(send.mock.calls[0][0].text).toContain("Reste à régler sur l'acompte : 86 000 FCFA");

      // Le complément exact n'exige aucune reconnaissance d'écart.
      const seconde = await acomptes.confirmerReception(
        demande.id,
        { montant: 86_000, montantRecuAvant: 100_000, referenceTransaction: "TX-002" },
        autreAdminId,
      );
      expect(seconde.sens).toBe("exact");
      expect(seconde.acompte).toMatchObject({ statut: "paye", montantRecu: 186_000 });

      // Un double clic sur le complément n'ajoute rien.
      expect(
        await codeDe(
          acomptes.confirmerReception(demande.id, { montant: 86_000, montantRecuAvant: 100_000 }, autreAdminId),
        ),
      ).toMatch(/ACOMPTE_CUMUL_CONCURRENT|ACOMPTE_NON_ATTENDU/);
      expect((await depot.parId(dossier.id))!.montantRecu).toBe(186_000);

      const journal = await depot.journal(dossier.id);
      expect(journal.filter((e) => e.type === "reception_confirmee").map((e) => e.acteurId)).toEqual([
        adminId,
        autreAdminId,
      ]);
      const anomalie = journal.find((e) => e.type === "anomalie_signalee")!;
      expect(anomalie.commentaire).toContain("reste dû 186000 FCFA");
      expect(anomalie.commentaire).toContain("reçu 100000 FCFA");
    });

    it("deux compléments simultanés : un seul passe", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      await acomptes.confirmerReception(
        demande.id,
        { montant: 100_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "partiel" },
        adminId,
      );

      const issues = await Promise.allSettled(
        [adminId, autreAdminId].map((acteur) =>
          acomptes.confirmerReception(demande.id, { montant: 86_000, montantRecuAvant: 100_000 }, acteur),
        ),
      );
      expect(issues.filter((i) => i.status === "fulfilled")).toHaveLength(1);
      expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "paye", montantRecu: 186_000 });
    });
  });

  describe("montant supérieur", () => {
    it("exige une confirmation explicite, journalise l'écart, ne rembourse rien", async () => {
      const { demande, dossier, acomptes } = await dossierPret();

      expect(await codeDe(acomptes.confirmerReception(demande.id, { montant: 200_000, montantRecuAvant: 0 }, adminId))).toBe(
        "ACOMPTE_ECART_A_CONFIRMER",
      );
      expect((await depot.parId(dossier.id))!.montantRecu).toBe(0);

      const res = await acomptes.confirmerReception(
        demande.id,
        { montant: 200_000, montantRecuAvant: 0, ecartConfirme: true, commentaire: "Client a viré 200 000" },
        adminId,
      );
      expect(res.sens).toBe("superieur");
      expect(res.ecart).toBe(14_000);
      expect(res.acompte).toMatchObject({ statut: "paye", montantRecu: 200_000 });

      const journal = await depot.journal(dossier.id);
      expect(journal.some((e) => e.type.startsWith("remboursement") || e.statutApres === "a_rembourser")).toBe(false);
      const anomalie = journal.find((e) => e.type === "anomalie_signalee")!;
      expect(anomalie.montant).toBe(14_000);
      expect(anomalie.commentaire).toContain("reste dû 186000 FCFA, reçu 200000 FCFA, écart +14000 FCFA");
      expect(send.mock.calls[0][0].text).toContain("aucun remboursement n'a été effectué automatiquement");
    });
  });

  describe("concurrence et doubles validations", () => {
    it("dix validations simultanées du même versement n'en comptent qu'une", async () => {
      const { demande, dossier, acomptes } = await dossierPret();

      const issues = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          acomptes.confirmerReception(
            demande.id,
            { montant: 186_000, montantRecuAvant: 0 },
            i % 2 ? adminId : autreAdminId,
          ),
        ),
      );
      expect(issues.filter((i) => i.status === "fulfilled")).toHaveLength(1);
      for (const refus of issues.filter((i): i is PromiseRejectedResult => i.status === "rejected")) {
        expect((refus.reason as ErreurMetier).getResponse()).toMatchObject({
          code: expect.stringMatching(/ACOMPTE_CUMUL_CONCURRENT|ACOMPTE_NON_ATTENDU/),
        });
      }

      const apres = (await depot.parId(dossier.id))!;
      expect(apres).toMatchObject({ statut: "paye", montantRecu: 186_000 });
      expect((await depot.journal(dossier.id)).filter((e) => e.type === "reception_confirmee")).toHaveLength(1);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("refuse un cumul périmé et une référence de transaction déjà consignée", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      const partiel = { ecartConfirme: true, commentaire: "partiel" };

      await acomptes.confirmerReception(
        demande.id,
        { montant: 50_000, montantRecuAvant: 0, referenceTransaction: "TX-DOUBLON", ...partiel },
        adminId,
      );
      expect(
        await codeDe(acomptes.confirmerReception(demande.id, { montant: 50_000, montantRecuAvant: 0, ...partiel }, adminId)),
      ).toBe("ACOMPTE_CUMUL_CONCURRENT");
      expect(
        await codeDe(
          acomptes.confirmerReception(
            demande.id,
            { montant: 50_000, montantRecuAvant: 50_000, referenceTransaction: "TX-DOUBLON", ...partiel },
            adminId,
          ),
        ),
      ).toBe("ACOMPTE_RECEPTION_DOUBLON");
      expect((await depot.parId(dossier.id))!.montantRecu).toBe(50_000);
    });
  });

  describe("demandes mortes et dossiers clos", () => {
    it.each(["annulee", "refusee", "expiree"] as const)(
      "refuse toute réception sur une demande « %s » sans la rouvrir",
      async (statut) => {
        const { demande, dossier, acomptes } = await dossierPret();
        await prisma.demand.update({ where: { id: demande.id }, data: { statut } });

        expect(
          await codeDe(acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId)),
        ).toBe("ACOMPTE_DEMANDE_CLOSE");
        expect(await statutDemande(demande.id)).toBe(statut);
        expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "en_attente", montantRecu: 0 });
        expect(send).not.toHaveBeenCalled();
      },
    );

    it("refuse une réception sur un acompte annulé ou déjà payé", async () => {
      const { demande, acomptes } = await dossierPret();
      await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      expect(
        await codeDe(acomptes.confirmerReception(demande.id, { montant: 1, montantRecuAvant: 186_000, ecartConfirme: true, commentaire: "x" }, adminId)),
      ).toBe("ACOMPTE_NON_ATTENDU");

      const autre = await dossierPret();
      await autre.acomptes.synchroniserFinDeDemande(autre.demande.id, "annulee");
      expect(
        await codeDe(autre.acomptes.confirmerReception(autre.demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId)),
      ).toBe("ACOMPTE_NON_ATTENDU");
    });

    it("consigne l'argent arrivé après l'échéance sans rien décider ni écrire au visiteur", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      await prisma.depositPayment.update({ where: { id: dossier.id }, data: { statut: "expire" } });

      const res = await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      expect(res.emailConfirmation).toBe("non_requis");
      expect(res.acompte).toMatchObject({ statut: "expire", montantRecu: 186_000 });
      expect(send).not.toHaveBeenCalled();
      expect(await statutDemande(demande.id)).toBe("acceptee");

      const vue = await acomptes.lireVue(demande.id);
      expect(vue.actions.deciderPaiementTardif).toBe(true);
    });
  });

  describe("e-mails : échec et renvoi", () => {
    it("conserve le paiement quand l'e-mail échoue, consigne l'échec, puis renvoie sans rien recompter", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "adresse refusée" } });

      const res = await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      expect(res.emailConfirmation).toBe("echec");
      expect(res.acompte).toMatchObject({ statut: "paye", montantRecu: 186_000 });
      const echec = (await depot.journal(dossier.id)).find((e) => e.type === "envoi_echoue")!;
      expect(echec.commentaire).toContain("Confirmation de réception non envoyée");

      send.mockResolvedValue({ data: { id: "em_ok" }, error: null });
      expect(await acomptes.renvoyerConfirmation(demande.id, autreAdminId)).toBe("envoye");

      const apres = (await depot.parId(dossier.id))!;
      expect(apres.montantRecu).toBe(186_000);
      expect((await depot.journal(dossier.id)).filter((e) => e.type === "reception_confirmee")).toHaveLength(1);
    });

    it("sans adresse sur le compte : paiement enregistré, échec d'envoi consigné", async () => {
      const { demande, dossier, acomptes } = await dossierPret(false);
      const res = await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      expect(res.emailConfirmation).toBe("sans_destinataire");
      expect(res.acompte.statut).toBe("paye");
      expect((await depot.journal(dossier.id)).some((e) => e.type === "envoi_echoue")).toBe(true);
    });

    it("n'a rien à renvoyer tant qu'aucune réception n'est constatée", async () => {
      const { demande, acomptes } = await dossierPret();
      expect(await codeDe(acomptes.renvoyerConfirmation(demande.id, adminId))).toBe("ACOMPTE_RIEN_A_CONFIRMER");
    });

    it("renvoie les instructions de paiement sans créer de second dossier ni de paiement", async () => {
      const { demande, dossier, acomptes } = await dossierPret();
      expect(await acomptes.renvoyerInstructionsPourDemande(demande.id, adminId)).toBe("envoyees");

      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0][0];
      expect(mail.text).toContain("sous réserve");
      expect(mail.text).toContain("TITULAIRE-WAVE-DE-TEST");
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(1);
      expect((await depot.parId(dossier.id))!).toMatchObject({ statut: "en_attente", montantRecu: 0 });
      const renvoi = (await depot.journal(dossier.id)).filter((e) => e.type === "instructions_envoyees");
      expect(renvoi.at(-1)!.acteurId).toBe(adminId);
    });

    it("refuse de renvoyer des instructions pour un acompte déjà payé", async () => {
      const { demande, acomptes } = await dossierPret();
      await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      send.mockClear();
      expect(await acomptes.renvoyerInstructionsPourDemande(demande.id, adminId)).toBe("non_requises");
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("lecture pour l'écran d'équipe", () => {
    it("calcule tout côté serveur et expose les coordonnées et les actions", async () => {
      const { demande, acomptes } = await dossierPret();
      const vue = await acomptes.lireVue(demande.id);

      expect(vue.actif).toBe(true);
      expect(vue.statutDemande).toBe("acceptee");
      expect(vue.acompte).toMatchObject({ montantTotal: 620_000, montantAttendu: 186_000, montantRecu: 0 });
      expect(vue.resteDu).toBe(186_000);
      expect(vue.soldeApresAcompte).toBe(434_000);
      expect(vue.coordonnees?.moyens).toEqual(["virement", "wave"]);
      expect(vue.actions).toMatchObject({
        preparer: false,
        confirmerReception: true,
        renvoyerInstructions: true,
        renvoyerConfirmation: false,
      });

      await acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      const payee = await acomptes.lireVue(demande.id);
      expect(payee.actions).toMatchObject({ confirmerReception: false, renvoyerConfirmation: true });
      expect(payee.acteurs[adminId]).toBe("Aminata Admin");
    });

    it("propose d'ouvrir le dossier d'une demande acceptée alors que l'acompte était fermé", async () => {
      const id = `visiteur-recep-${suffixe()}`;
      await prisma.account.create({ data: { id, email: `${id}@test.local` } });
      const demande = await depotDemandes.creerLogement({
        logementId: "l-001", debut: "2026-11-10", fin: "2026-11-14", personnes: 2, visiteurId: id,
      });
      const fermee = monter({ actif: false, pourcentage: undefined, etatCoordonnees: "absent", beneficiaire: undefined });
      await fermee.demandes.accepterParPartenaire(demande.id);
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(0);

      expect((await fermee.acomptes.lireVue(demande.id)).actif).toBe(false);
      expect(await fermee.acomptes.ouvrir(demande.id)).toEqual({ etat: "desactive" });

      const ouverte = monter();
      const vue = await ouverte.acomptes.lireVue(demande.id);
      expect(vue.apercu).toEqual({ pourcentage: 30, montantTotal: 620_000, montantAttendu: 186_000, solde: 434_000 });
      expect(vue.actions.preparer).toBe(true);

      expect(await ouverte.acomptes.ouvrir(demande.id)).toMatchObject({ etat: "prepare", cree: true });
      expect(await ouverte.acomptes.ouvrir(demande.id)).toMatchObject({ etat: "prepare", cree: false, instructions: "deja_envoyees" });
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(1);
    });

    it("garde un dossier existant exploitable quand le verrou est refermé", async () => {
      const { demande } = await dossierPret();
      const fermee = monter({ actif: false, pourcentage: undefined, etatCoordonnees: "absent", beneficiaire: undefined });
      const res = await fermee.acomptes.confirmerReception(demande.id, { montant: 186_000, montantRecuAvant: 0 }, adminId);
      expect(res.acompte.statut).toBe("paye");
    });
  });
});
