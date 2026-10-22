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
import type { DepotAcomptes } from "./acomptes.depot";
import { DepotAcomptesPrisma } from "./acomptes.prisma";
import { ServiceAcomptes } from "./acomptes.service";

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
 * Une configuration d'acompte **ouverte**, pour ces tests seulement.
 *
 * Les coordonnées sont les sentinelles de `configuration.test.ts`. La
 * configuration réelle de l'API, elle, reste fermée : aucun de ces tests ne
 * touche `ACOMPTE_ACTIF`.
 */
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

const FERMEE: ConfigAcompte = {
  actif: false,
  pourcentage: undefined,
  etatCoordonnees: "absent",
  beneficiaire: undefined,
};

describe("Service Acomptes — préparation à l'acceptation et instructions", () => {
  let prisma: PrismaService;
  let depot: DepotAcomptesPrisma;
  let depotDemandes: DepotDemandesPrisma;
  let administrateurId: string;
  let send: ReturnType<typeof vi.fn>;

  const suffixe = () => randomBytes(4).toString("hex");

  /** Un ensemble câblé comme dans l'application, Resend remplacé par `send`. */
  const monter = (configAcompte: ConfigAcompte = OUVERTE, depotAcomptes: DepotAcomptes = depot) => {
    const email = new ServiceEmail({ emails: { send } } as unknown as Resend);
    const acomptes = new ServiceAcomptes(depotAcomptes, email, configAcompte);
    return { acomptes, demandes: new ServiceDemandes(depotDemandes, acomptes) };
  };

  /** Un visiteur qui a une adresse : sans elle, il n'y a personne à qui écrire. */
  const visiteur = async (avecEmail = true) => {
    const id = `visiteur-acompte-svc-${suffixe()}`;
    await prisma.account.create({
      data: { id, email: avecEmail ? `${id}@test.local` : null },
    });
    return id;
  };

  const logement = async (visiteurId?: string) =>
    depotDemandes.creerLogement({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-14",
      personnes: 2,
      visiteurId: visiteurId ?? (await visiteur()),
    });

  const vehicule = async (prestation: "trajet" | "journee" | "taxi") =>
    depotDemandes.creerVehicule({
      vehiculeId: "v-001",
      prestation,
      depart: "Dakar",
      arrivee: "Saly",
      quand: "2026-11-10T09:00",
      passagers: 2,
      bagages: 1,
      visiteurId: await visiteur(),
    });

  const dossierDe = (demandeId: string) => prisma.depositPayment.findUnique({ where: { demandeId } });

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotAcomptesPrisma(prisma);
    depotDemandes = new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures());
    const admin = await prisma.account.create({
      data: { email: `admin-acompte-svc-${suffixe()}@test.local`, role: "ADMINISTRATEUR" },
    });
    administrateurId = admin.id;
  });

  beforeEach(() => {
    send = vi.fn().mockResolvedValue({ data: { id: "em_test" }, error: null });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("acceptation", () => {
    it("prépare l'acompte quand le partenaire accepte un logement, et envoie les instructions une fois", async () => {
      const { demandes } = monter();
      const demande = await logement();

      const avant = Date.now();
      const acceptee = await demandes.accepterParPartenaire(demande.id);
      expect(acceptee.statut).toBe("acceptee");

      const dossier = await dossierDe(demande.id);
      expect(dossier).not.toBeNull();
      expect(dossier!.pourcentageApplique).toBe(30);
      expect(dossier!.montantAttendu).toBe(Math.round(demande.prix.total * 0.3));
      expect(dossier!.instructionsEnvoyeesLe).not.toBeNull();

      // Douze heures depuis l'acceptation — celle inscrite dans la frise.
      const accepteeLe = new Date(acceptee.frise.at(-1)!.horodatage).getTime();
      expect(dossier!.echeanceLe.getTime()).toBe(accepteeLe + 12 * 3_600_000);
      expect(accepteeLe).toBeGreaterThanOrEqual(avant - 1);

      expect(send).toHaveBeenCalledTimes(1);
      const [message, options] = send.mock.calls[0];
      expect(message.to).toMatch(/@test\.local$/);
      expect(message.text).toContain(demande.reference);
      expect(message.text).toContain("IBAN DETE STNE PASU TILI SER");
      expect(options).toEqual({ idempotencyKey: `acompte-instructions-${dossier!.id}` });

      expect((await depot.journal(dossier!.id)).map((e) => e.type)).toEqual([
        "preparation",
        "instructions_envoyees",
      ]);
    });

    it("prépare aussi quand l'équipe accepte une location", async () => {
      const { demandes } = monter();
      const demande = await vehicule("journee");
      await demandes.transitionner(demande.id, "acceptee", "equipe");
      expect(await dossierDe(demande.id)).not.toBeNull();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("ne touche pas l'échéance de la demande : deux calendriers, deux colonnes", async () => {
      const { demandes } = monter();
      const demande = await logement();
      const acceptee = await demandes.accepterParPartenaire(demande.id);

      const ligne = await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } });
      expect(ligne.expireLe?.toISOString()).toBe(acceptee.expireLe);
      expect(ligne.statut).toBe("acceptee");
    });

    it("ne prépare rien tant que l'acompte est fermé", async () => {
      const { demandes } = monter(FERMEE);
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      expect(await dossierDe(demande.id)).toBeNull();
      expect(send).not.toHaveBeenCalled();
    });

    it("reste fermé avec la configuration réelle de l'API", async () => {
      expect(process.env.ACOMPTE_ACTIF ?? "").not.toBe("true");
      const email = new ServiceEmail({ emails: { send } } as unknown as Resend);
      const demandes = new ServiceDemandes(depotDemandes, new ServiceAcomptes(depot, email));
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      expect(await dossierDe(demande.id)).toBeNull();
      expect(send).not.toHaveBeenCalled();
    });

    it("ne prépare rien sur une demande qui n'est pas acceptée", async () => {
      const { acomptes } = monter();
      const demande = await logement();
      expect(await acomptes.preparer(demande, new Date())).toEqual({ etat: "statut_incompatible" });
      expect(await dossierDe(demande.id)).toBeNull();
    });
  });

  describe("catégories et prix", () => {
    it("exclut le taxi et le trajet : acceptés, sans acompte ni e-mail", async () => {
      const { demandes, acomptes } = monter();
      for (const prestation of ["taxi", "trajet"] as const) {
        const demande = await vehicule(prestation);
        const acceptee = await demandes.accepterParPartenaire(demande.id);
        expect(acceptee.statut).toBe("acceptee");
        expect(await dossierDe(demande.id)).toBeNull();
        expect(await acomptes.preparer(acceptee, new Date())).toEqual({ etat: "non_eligible" });
      }
      expect(send).not.toHaveBeenCalled();
    });

    it("exclut le service à la demande", async () => {
      const { acomptes } = monter();
      const demande = await depotDemandes.creerService({
        service: "guides",
        details: { zone: "Dakar" },
        visiteurId: await visiteur(),
      });
      const issue = await acomptes.preparer({ ...demande, statut: "acceptee" }, new Date());
      expect(issue).toEqual({ etat: "non_eligible" });
      expect(await dossierDe(demande.id)).toBeNull();
    });

    it("ne demande rien sur un prix nul", async () => {
      const { demandes, acomptes } = monter();
      const demande = await logement();
      await prisma.demand.update({ where: { id: demande.id }, data: { prixTotal: 0 } });

      const acceptee = await demandes.accepterParPartenaire(demande.id);
      expect(acceptee.statut).toBe("acceptee");
      expect(await dossierDe(demande.id)).toBeNull();
      expect(await acomptes.preparer(acceptee, new Date())).toEqual({ etat: "montant_nul" });
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("doublons", () => {
    it("rejouée, la préparation ne crée pas de second dossier ni ne renvoie les instructions", async () => {
      const { demandes, acomptes } = monter();
      const demande = await logement();
      const acceptee = await demandes.accepterParPartenaire(demande.id);

      const seconde = await acomptes.preparer(acceptee, new Date());
      expect(seconde).toMatchObject({ etat: "prepare", cree: false, instructions: "deja_envoyees" });
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("concurrente, elle ne crée qu'un dossier, n'utilise qu'une clé, et ne marque qu'une fois", async () => {
      const { demandes, acomptes } = monter();
      const demande = await logement();
      const acceptee = await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;

      // On rouvre la fenêtre : le marqueur n'est pas posé, cinq préparations
      // arrivent en même temps.
      await prisma.depositPayment.update({ where: { id: dossier.id }, data: { instructionsEnvoyeesLe: null } });
      send.mockClear();

      const issues = await Promise.all(
        Array.from({ length: 5 }, () => acomptes.preparer(acceptee, new Date())),
      );
      expect(issues.every((issue) => issue.etat === "prepare" && !issue.cree)).toBe(true);
      expect(await prisma.depositPayment.count({ where: { demandeId: demande.id } })).toBe(1);

      // Plusieurs appels peuvent partir : c'est la clé d'idempotence, unique,
      // qui empêche Resend d'envoyer deux fois. Le journal, lui, ne compte
      // qu'un marquage de plus.
      const cles = new Set(send.mock.calls.map((appel) => appel[1].idempotencyKey));
      expect([...cles]).toEqual([`acompte-instructions-${dossier.id}`]);
      expect(
        await prisma.depositPaymentEvent.count({
          where: { acompteId: dossier.id, type: "instructions_envoyees" },
        }),
      ).toBe(2);
    });
  });

  describe("échec d'e-mail", () => {
    it("garde la demande acceptée, consigne l'échec et laisse le renvoi possible", async () => {
      send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "adresse refusée" } });
      const { demandes, acomptes } = monter();
      const demande = await logement();

      const acceptee = await demandes.accepterParPartenaire(demande.id);
      expect(acceptee.statut).toBe("acceptee");
      expect((await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } })).statut).toBe("acceptee");

      const dossier = (await dossierDe(demande.id))!;
      expect(dossier.instructionsEnvoyeesLe).toBeNull();
      const journal = await depot.journal(dossier.id);
      expect(journal.at(-1)).toMatchObject({ type: "envoi_echoue" });
      expect(journal.at(-1)!.commentaire).toContain("validation_error");
      expect(journal.at(-1)!.commentaire).not.toContain("IBAN");

      // Resend revient : le renvoi part, et cette fois le marqueur est posé.
      send.mockResolvedValue({ data: { id: "em_2" }, error: null });
      expect(await acomptes.envoyerInstructions(dossier.id)).toBe("envoyees");
      expect((await dossierDe(demande.id))!.instructionsEnvoyeesLe).not.toBeNull();
    });

    it("garde la demande acceptée même si la base des acomptes est en panne", async () => {
      const enPanne = {
        preparer: vi.fn().mockRejectedValue(new Error("connexion perdue")),
      } as unknown as DepotAcomptes;
      const { demandes } = monter(OUVERTE, enPanne);
      const demande = await logement();

      const acceptee = await demandes.accepterParPartenaire(demande.id);
      expect(acceptee.statut).toBe("acceptee");
      expect((await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } })).statut).toBe("acceptee");
      expect(send).not.toHaveBeenCalled();
    });

    it("consigne l'absence d'adresse au lieu de se taire", async () => {
      const { demandes } = monter();
      const demande = await logement(await visiteur(false));
      await demandes.accepterParPartenaire(demande.id);

      const dossier = (await dossierDe(demande.id))!;
      expect(dossier.instructionsEnvoyeesLe).toBeNull();
      expect((await depot.journal(dossier.id)).at(-1)).toMatchObject({ type: "envoi_echoue" });
      expect(send).not.toHaveBeenCalled();
    });

    it("ne renvoie rien pour un dossier qui n'attend plus de virement", async () => {
      send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "x" } });
      const { demandes, acomptes } = monter();
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;
      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "annule" }, { type: "annulation" });

      send.mockClear();
      expect(await acomptes.envoyerInstructions(dossier.id)).toBe("non_requises");
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("preuve et paiement", () => {
    it("ne passe jamais à « payé » sur une preuve déclarée", async () => {
      const { demandes } = monter();
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;

      await depot.consigner(dossier.id, {
        type: "preuve_declaree",
        montant: dossier.montantAttendu,
        commentaire: "Capture d'écran du virement envoyée par le visiteur.",
      });
      expect(
        await codeDe(
          depot.changerStatut(
            dossier.id,
            { de: "en_attente", vers: "paye" },
            { type: "preuve_declaree", montant: dossier.montantAttendu, acteurId: administrateurId },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      // Une vérification sans réception constatée ne suffit pas non plus.
      expect(
        await codeDe(
          depot.changerStatut(
            dossier.id,
            { de: "en_attente", vers: "paye" },
            { type: "verification", acteurId: administrateurId, commentaire: "Vu la capture." },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");

      const apres = (await depot.parId(dossier.id))!;
      expect(apres.statut).toBe("en_attente");
      expect(apres.montantRecu).toBe(0);
    });
  });

  describe("paiement tardif", () => {
    /** Un acompte expiré sur lequel un virement complet a été constaté ensuite. */
    const tardif = async (montant?: number) => {
      const { demandes, acomptes } = monter();
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;
      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      await depot.consigner(dossier.id, {
        type: "reception_confirmee",
        montant: montant ?? dossier.montantAttendu,
        acteurId: administrateurId,
        referenceTransaction: "VIR-TARDIF",
      });
      return { demande, dossier, acomptes };
    };

    it("s'accepte sur décision humaine commentée, si la demande vit encore", async () => {
      const { dossier, acomptes } = await tardif();
      const paye = await acomptes.deciderPaiementTardif(dossier.id, {
        issue: "accepter",
        acteurId: administrateurId,
        commentaire: "Propriétaire joint : le logement est toujours disponible.",
      });
      expect(paye.statut).toBe("paye");
      expect((await depot.journal(dossier.id)).at(-1)).toMatchObject({
        type: "verification",
        statutAvant: "expire",
        statutApres: "paye",
        acteurId: administrateurId,
      });
    });

    it("exige un examen écrit", async () => {
      const { dossier, acomptes } = await tardif();
      expect(
        await codeDe(acomptes.deciderPaiementTardif(dossier.id, { issue: "accepter", acteurId: administrateurId, commentaire: " " })),
      ).toBe("ACOMPTE_EXAMEN_REQUIS");
      // Et le dépôt refuse aussi de sauter l'examen.
      expect(
        await codeDe(
          depot.changerStatut(
            dossier.id,
            { de: "expire", vers: "paye" },
            { type: "reception_confirmee", montant: 1, acteurId: administrateurId },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");
      expect((await depot.parId(dossier.id))!.statut).toBe("expire");
    });

    it("ne s'accepte pas pour une demande morte, et ne la réactive pas", async () => {
      const { demande, dossier, acomptes } = await tardif();
      await prisma.demand.update({ where: { id: demande.id }, data: { statut: "expiree" } });
      const avant = await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } });

      expect(
        await codeDe(
          acomptes.deciderPaiementTardif(dossier.id, {
            issue: "accepter",
            acteurId: administrateurId,
            commentaire: "Le visiteur insiste.",
          }),
        ),
      ).toBe("ACOMPTE_DEMANDE_CLOSE");
      expect(await prisma.demand.findUniqueOrThrow({ where: { id: demande.id } })).toEqual(avant);
      expect((await depot.parId(dossier.id))!.statut).toBe("expire");
    });

    it("ne s'accepte pas incomplet, ni sans réception, ni hors retard", async () => {
      const incomplet = await tardif(1);
      expect(
        await codeDe(
          incomplet.acomptes.deciderPaiementTardif(incomplet.dossier.id, {
            issue: "accepter",
            acteurId: administrateurId,
            commentaire: "Disponible.",
          }),
        ),
      ).toBe("ACOMPTE_PAIEMENT_INCOMPLET");

      const { demandes, acomptes } = monter();
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;
      const decision = { issue: "accepter" as const, acteurId: administrateurId, commentaire: "Disponible." };
      expect(await codeDe(acomptes.deciderPaiementTardif(dossier.id, decision))).toBe("ACOMPTE_PAS_EN_RETARD");

      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      expect(await codeDe(acomptes.deciderPaiementTardif(dossier.id, decision))).toBe("ACOMPTE_RIEN_RECU");
    });
  });

  describe("remboursement", () => {
    it("va de la décision au constat, et s'arrête à « remboursé »", async () => {
      const { demandes, acomptes } = monter();
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;
      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      await depot.consigner(dossier.id, {
        type: "reception_confirmee",
        montant: dossier.montantAttendu,
        acteurId: administrateurId,
      });

      const aRembourser = await acomptes.deciderPaiementTardif(dossier.id, {
        issue: "rembourser",
        acteurId: administrateurId,
        commentaire: "Logement reloué entre-temps.",
      });
      expect(aRembourser.statut).toBe("a_rembourser");

      // Décider n'est pas avoir remboursé : sans constat chiffré et signé, rien.
      expect(
        await codeDe(
          depot.changerStatut(
            dossier.id,
            { de: "a_rembourser", vers: "rembourse" },
            { type: "remboursement_decide", montant: dossier.montantAttendu, acteurId: administrateurId },
          ),
        ),
      ).toBe("ACOMPTE_EVENEMENT_INVALIDE");

      const rembourse = await acomptes.confirmerRemboursement(dossier.id, {
        acteurId: administrateurId,
        montant: dossier.montantAttendu,
        referenceTransaction: "VIR-RETOUR-1",
      });
      expect(rembourse.statut).toBe("rembourse");

      expect(
        await codeDe(
          depot.changerStatut(dossier.id, { de: "rembourse", vers: "a_rembourser" }, { type: "verification" }),
        ),
      ).toBe("ACOMPTE_TRANSITION_INTERDITE");

      expect((await depot.journal(dossier.id)).slice(-3).map((e) => e.type)).toEqual([
        "reception_confirmee",
        "remboursement_decide",
        "remboursement_effectue",
      ]);
    });

    it("ne confirme pas un remboursement qui n'a pas été décidé", async () => {
      const { demandes, acomptes } = monter();
      const demande = await logement();
      await demandes.accepterParPartenaire(demande.id);
      const dossier = (await dossierDe(demande.id))!;
      expect(
        await codeDe(
          acomptes.confirmerRemboursement(dossier.id, { acteurId: administrateurId, montant: 1000 }),
        ),
      ).toBe("ACOMPTE_STATUT_CONCURRENT");
    });
  });

  describe("échéances : la demande prime sur l'acompte", () => {
    const HEURE = 3_600_000;
    /** L'instant d'acceptation inscrit dans la frise. */
    const t0 = (demande: { frise: { horodatage: string }[] }) => Date.parse(demande.frise.at(-1)!.horodatage);

    it("fige le délai de confirmation actuel d'une location : trois heures", async () => {
      // Comportement **actuel**, documenté tel quel : un véhicule reçoit le
      // délai du trajet (`demandes.service.ts`), et non `DELAIS.location`, qui
      // déclare douze heures sans être lu à cet endroit.
      const { demandes } = monter(FERMEE);
      const acceptee = await demandes.accepterParPartenaire((await vehicule("journee")).id);
      const ecart = Date.parse(acceptee.expireLe!) - t0(acceptee);
      expect(ecart).toBeGreaterThanOrEqual(3 * HEURE);
      expect(ecart).toBeLessThan(3 * HEURE + 1_000);
    });

    it("plafonne l'acompte d'une location à l'échéance de la demande : trois heures, pas douze", async () => {
      const { demandes } = monter();
      const acceptee = await demandes.accepterParPartenaire((await vehicule("journee")).id);
      const dossier = (await dossierDe(acceptee.id))!;

      expect(dossier.echeanceLe.toISOString()).toBe(acceptee.expireLe);
      expect(dossier.echeanceLe.getTime()).toBeLessThan(t0(acceptee) + 12 * HEURE);
      // Et l'e-mail annonce cette échéance-là.
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("garde douze heures pour un logement, sans jamais dépasser son échéance", async () => {
      const { demandes } = monter();
      const acceptee = await demandes.accepterParPartenaire((await logement()).id);
      const dossier = (await dossierDe(acceptee.id))!;

      expect(dossier.echeanceLe.getTime()).toBe(t0(acceptee) + 12 * HEURE);
      expect(dossier.echeanceLe.getTime()).toBeLessThanOrEqual(Date.parse(acceptee.expireLe!));
    });

    /**
     * Le plafond vient de la **base**, pas de l'objet passé au service.
     *
     * C'est le changement de cette correction : l'échéance se déduit du genre,
     * et le genre fin n'est lisible qu'en base — donc le dépôt lit la ligne, et
     * y lit aussi `expireLe`. Poser l'échéance sur l'objet de contrat n'aurait
     * plus aucun effet, et un test qui le ferait croire serait un faux témoin.
     * On écrit donc l'état voulu dans la ligne, puis on prépare.
     */
    const avecExpiration = async (demandeId: string, expireLe: Date | null) => {
      await prisma.demand.update({ where: { id: demandeId }, data: { expireLe } });
    };

    it("n'invente pas d'échéance de demande quand la ligne n'en porte pas", async () => {
      const { acomptes } = monter();
      const demande = await logement();
      await avecExpiration(demande.id, null);
      const accepteeLe = new Date("2026-11-01T08:00:00.000Z");

      await acomptes.preparer({ ...demande, statut: "acceptee" }, accepteeLe);
      expect((await dossierDe(demande.id))!.echeanceLe.toISOString()).toBe("2026-11-01T20:00:00.000Z");
    });

    it("retient l'échéance de la demande quand elle tombe avant les douze heures", async () => {
      const { acomptes } = monter();
      const demande = await logement();
      await avecExpiration(demande.id, new Date("2026-11-01T09:30:00.000Z"));
      const accepteeLe = new Date("2026-11-01T08:00:00.000Z");

      await acomptes.preparer({ ...demande, statut: "acceptee" }, accepteeLe);
      expect((await dossierDe(demande.id))!.echeanceLe.toISOString()).toBe("2026-11-01T09:30:00.000Z");
    });

    it("n'ouvre aucun dossier quand l'expiration de la demande précède l'acceptation", async () => {
      const { acomptes } = monter();
      const demande = await logement();
      await avecExpiration(demande.id, new Date("2026-11-01T07:00:00.000Z"));

      const issue = await acomptes.preparer(
        { ...demande, statut: "acceptee" },
        new Date("2026-11-01T08:00:00.000Z"),
      );

      // Mieux vaut ne rien réclamer que réclamer un virement déjà échu.
      expect(issue).toEqual({ etat: "echeance_invalide" });
      expect(await dossierDe(demande.id)).toBeNull();
    });
  });

  describe("fin de demande : l'acompte suit", () => {
    /** Une demande de logement acceptée, avec son acompte en attente. */
    const accepteeAvecAcompte = async () => {
      const montage = monter();
      const acceptee = await montage.demandes.accepterParPartenaire((await logement()).id);
      return { ...montage, acceptee, dossier: (await dossierDe(acceptee.id))! };
    };

    it("expirée : l'acompte en attente est annulé, le journal s'allonge sans rien perdre", async () => {
      const { demandes, acceptee, dossier } = await accepteeAvecAcompte();
      const avant = await depot.journal(dossier.id);

      const expiree = await demandes.transitionner(acceptee.id, "expiree", "systeme");
      expect(expiree.statut).toBe("expiree");

      expect((await dossierDe(acceptee.id))!.statut).toBe("annule");
      const journal = await depot.journal(dossier.id);
      expect(journal.slice(0, avant.length)).toEqual(avant);
      expect(journal.at(-1)).toMatchObject({ type: "annulation", statutAvant: "en_attente", statutApres: "annule" });
      // Jamais réactivée.
      expect((await prisma.demand.findUniqueOrThrow({ where: { id: acceptee.id } })).statut).toBe("expiree");
    });

    it("annulée par le visiteur : l'acompte en attente est annulé, sans e-mail", async () => {
      const { demandes, acceptee } = await accepteeAvecAcompte();
      send.mockClear();
      await demandes.annuler(acceptee.id);
      expect((await dossierDe(acceptee.id))!.statut).toBe("annule");
      expect(send).not.toHaveBeenCalled();
    });

    it("refusée : l'acompte en attente est annulé", async () => {
      const { demandes } = monter();
      const demande = await logement();
      // Hors parcours normal — l'acompte naît à l'acceptation — mais le
      // branchement doit tenir pour tout dossier qui existerait.
      await depot.preparer({
        demandeId: demande.id,
        pourcentage: 30,
        accepteeLe: new Date().toISOString(),
      });

      await demandes.refuserParPartenaire(demande.id, "plus-disponible");
      expect((await dossierDe(demande.id))!.statut).toBe("annule");
    });

    it("partiellement payé : l'acompte part en remboursement, montant reçu conservé", async () => {
      const { demandes, acceptee, dossier } = await accepteeAvecAcompte();
      await depot.changerStatut(
        dossier.id,
        { de: "en_attente", vers: "partiel" },
        { type: "reception_confirmee", montant: 1_000, acteurId: administrateurId },
      );

      await demandes.annuler(acceptee.id);

      const apres = (await dossierDe(acceptee.id))!;
      expect(apres.statut).toBe("a_rembourser");
      expect(apres.montantRecu).toBe(1_000);
      expect((await depot.journal(dossier.id)).at(-1)).toMatchObject({
        type: "annulation",
        statutAvant: "partiel",
        statutApres: "a_rembourser",
        montant: 1_000,
      });
    });

    it("déjà payé : l'acompte n'est pas traité comme en attente", async () => {
      const { demandes, acceptee, dossier } = await accepteeAvecAcompte();
      await depot.changerStatut(
        dossier.id,
        { de: "en_attente", vers: "paye" },
        { type: "reception_confirmee", montant: dossier.montantAttendu, acteurId: administrateurId },
      );

      await demandes.annuler(acceptee.id);
      expect((await dossierDe(acceptee.id))!.statut).toBe("paye");
    });

    it("sans dossier : la transition réussit, rien n'est créé", async () => {
      const { demandes } = monter(FERMEE);
      const acceptee = await demandes.accepterParPartenaire((await logement()).id);
      const annulee = await demandes.annuler(acceptee.id);
      expect(annulee.statut).toBe("annulee");
      expect(await dossierDe(acceptee.id)).toBeNull();
    });

    it("synchronisation en panne : la transition de la demande réussit quand même", async () => {
      const { acceptee } = await accepteeAvecAcompte();
      const enPanne = {
        parDemande: vi.fn().mockRejectedValue(new Error("connexion perdue")),
      } as unknown as DepotAcomptes;
      const { demandes } = monter(OUVERTE, enPanne);

      const annulee = await demandes.annuler(acceptee.id);
      expect(annulee.statut).toBe("annulee");
      expect((await prisma.demand.findUniqueOrThrow({ where: { id: acceptee.id } })).statut).toBe("annulee");
      // Le dossier n'a pas suivi — c'est la trace d'erreur qui le dira.
      expect((await dossierDe(acceptee.id))!.statut).toBe("en_attente");
    });

    it("service d'acompte qui lève malgré son contrat : la transition réussit quand même", async () => {
      const { acceptee } = await accepteeAvecAcompte();
      const leve = {
        synchroniserFinDeDemande: vi.fn().mockRejectedValue(new Error("imprévu")),
      } as unknown as ServiceAcomptes;

      const annulee = await new ServiceDemandes(depotDemandes, leve).annuler(acceptee.id);
      expect(annulee.statut).toBe("annulee");
    });
  });

  describe("« payé » interdit sur une demande morte", () => {
    for (const morte of ["expiree", "annulee", "refusee"] as const) {
      it(`refusé au dépôt quand la demande est ${morte}, sans rien écrire`, async () => {
        const { demandes } = monter();
        const acceptee = await demandes.accepterParPartenaire((await logement()).id);
        const dossier = (await dossierDe(acceptee.id))!;
        // Statut posé directement : on veut le dossier encore « en_attente »
        // face à une demande morte — la course que le dépôt doit arrêter.
        await prisma.demand.update({ where: { id: acceptee.id }, data: { statut: morte } });
        const journalAvant = await depot.journal(dossier.id);

        expect(
          await codeDe(
            depot.changerStatut(
              dossier.id,
              { de: "en_attente", vers: "paye" },
              { type: "reception_confirmee", montant: dossier.montantAttendu, acteurId: administrateurId },
            ),
          ),
        ).toBe("ACOMPTE_DEMANDE_CLOSE");

        const apres = (await dossierDe(acceptee.id))!;
        expect(apres.statut).toBe("en_attente");
        expect(apres.montantRecu).toBe(0);
        expect(await depot.journal(dossier.id)).toEqual(journalAvant);
      });
    }

    it("refusé au dépôt même par la voie du paiement tardif", async () => {
      const { demandes } = monter();
      const acceptee = await demandes.accepterParPartenaire((await logement()).id);
      const dossier = (await dossierDe(acceptee.id))!;
      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      await depot.consigner(dossier.id, {
        type: "reception_confirmee",
        montant: dossier.montantAttendu,
        acteurId: administrateurId,
      });
      await prisma.demand.update({ where: { id: acceptee.id }, data: { statut: "expiree" } });

      expect(
        await codeDe(
          depot.changerStatut(
            dossier.id,
            { de: "expire", vers: "paye" },
            { type: "verification", acteurId: administrateurId, commentaire: "Contournement du service." },
          ),
        ),
      ).toBe("ACOMPTE_DEMANDE_CLOSE");
      expect((await dossierDe(acceptee.id))!.statut).toBe("expire");
    });

    it("le paiement tardif reste une décision humaine, et passe sur une demande confirmée", async () => {
      const { demandes, acomptes } = monter();
      const acceptee = await demandes.accepterParPartenaire((await logement()).id);
      await demandes.confirmer(acceptee.id);
      const dossier = (await dossierDe(acceptee.id))!;
      await depot.changerStatut(dossier.id, { de: "en_attente", vers: "expire" }, { type: "expiration_prononcee" });
      await depot.consigner(dossier.id, {
        type: "reception_confirmee",
        montant: dossier.montantAttendu,
        acteurId: administrateurId,
      });

      // Sans examen écrit, ni le service ni le dépôt n'acceptent.
      expect(
        await codeDe(
          acomptes.deciderPaiementTardif(dossier.id, { issue: "accepter", acteurId: administrateurId, commentaire: "" }),
        ),
      ).toBe("ACOMPTE_EXAMEN_REQUIS");

      const paye = await acomptes.deciderPaiementTardif(dossier.id, {
        issue: "accepter",
        acteurId: administrateurId,
        commentaire: "Séjour confirmé, logement toujours réservé au visiteur.",
      });
      expect(paye.statut).toBe("paye");
    });
  });
});
