import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Test } from "@nestjs/testing";
import type { DemandeAdmin, Demande } from "@teranga/contracts";
import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaModule } from "../../base-de-donnees/prisma.module";
import { PrismaService } from "../../base-de-donnees/prisma.service";
import { DEPOT_COORDONNEES } from "../../commun/depots/depot";
import { ModuleEmail } from "../../commun/email/email.module";
import { ErreurMetier } from "../../commun/erreurs";
import type { CompteDeSession, DepotComptes } from "../comptes/comptes.depot";
import { ServiceComptes } from "../comptes/comptes.service";
import { DepotDemandesFixtures } from "../demandes/demandes.fixtures";
import { ServiceDemandes } from "../demandes/demandes.service";
import type { DepotJetons } from "../reponses/jetons.depot";
import { ServiceReponses } from "../reponses/reponses.service";
import { ControleurAdministration } from "./administration.controller";
import { ModuleAdministration } from "./administration.module";
import { composerCsv, type ServiceAdministration } from "./administration.service";
import type { DepotCoordonnees } from "./coordonnees.depot";
import { DepotCoordonneesFixtures } from "./coordonnees.fixtures";
import { DepotCoordonneesPrisma } from "./coordonnees.prisma";
import { ServiceCoordonnees } from "./coordonnees.service";
import { validerCoordonnees } from "./coordonnees.validation";

/**
 * Les coordonnées côté équipe : routes, règles, confidentialité.
 *
 * Sans base : le dépôt en mémoire porte toute la logique de traçabilité, et
 * la base ne le peut pas encore — sa migration attend validation. Les valeurs
 * sont des sentinelles de test, et chaque message d'erreur est contrôlé pour
 * qu'aucune n'y apparaisse.
 */
const LOGEMENT = {
  adresseExacte: "ADRESSE-DE-TEST",
  telephone: "+221 00 000 00 00",
  consignesArrivee: "CONSIGNES-DE-TEST",
};
const VEHICULE = {
  immatriculation: "IMMAT-TEST-01",
  telephoneChauffeur: "+221 00 111 11 11",
  lieuDeRendezVous: "RENDEZ-VOUS-DE-TEST",
};
const SENTINELLES = [
  ...Object.values(LOGEMENT),
  ...Object.values(VEHICULE),
  "ADRESSE-CORRIGEE",
];

const ADMIN_A = { id: "admin-a", email: "a@equipe.test" };
const ADMIN_B = { id: "admin-b", email: "b@equipe.test" };

async function erreurDe(promesse: Promise<unknown>): Promise<{ code: string; message: string; statut: number }> {
  try {
    await promesse;
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      const corps = erreur.getResponse() as { code: string; message: string };
      // Aucune erreur ne cite une coordonnée — ni de test, ni réelle.
      for (const valeur of SENTINELLES) expect(corps.message).not.toContain(valeur);
      return { code: corps.code, message: corps.message, statut: erreur.getStatus() };
    }
    throw erreur;
  }
  throw new Error("La promesse aurait dû échouer.");
}

/** Un monde en mémoire : demandes, coordonnées, service. */
function monde() {
  const depotDemandes = new DepotDemandesFixtures();
  const demandes = new ServiceDemandes(depotDemandes);
  const depot = new DepotCoordonneesFixtures(depotDemandes);
  const coordonnees = new ServiceCoordonnees(depot);

  const logement = async (visiteurId = "visiteur-coordonnees") =>
    demandes.creerLogement({ logementId: "l-001", debut: "2026-11-10", fin: "2026-11-14", personnes: 2, visiteurId });
  const location = async (visiteurId = "visiteur-coordonnees") =>
    demandes.creerVehicule({
      vehiculeId: "v-001",
      prestation: "journee",
      depart: "Dakar",
      quand: "2026-11-10T09:00",
      passagers: 2,
      bagages: 1,
      visiteurId,
    });

  /** Logement accepté, coordonnées saisies par A. */
  const saisieParA = async () => {
    const demande = await logement();
    await demandes.accepterParPartenaire(demande.id);
    const vue = await coordonnees.saisir(demande.id, LOGEMENT, ADMIN_A);
    return { demande, vue };
  };

  return { depotDemandes, demandes, depot, coordonnees, logement, location, saisieParA };
}

describe("Coordonnées — routes d'administration", () => {
  const sessions: Record<string, CompteDeSession> = {
    "jeton-admin-a": { id: ADMIN_A.id, role: "ADMINISTRATEUR", email: ADMIN_A.email },
    "jeton-admin-b": { id: ADMIN_B.id, role: "ADMINISTRATEUR", email: ADMIN_B.email },
    "jeton-visiteur": { id: "visiteur-1", role: "VISITEUR", email: "v@exemple.test" },
    "jeton-partenaire": { id: "partenaire-1", role: "PRESTATAIRE", email: "p@exemple.test" },
  };
  const comptes = new ServiceComptes({
    compteDeSession: async (jeton: string) => sessions[jeton] ?? null,
  } as unknown as DepotComptes);

  let m: ReturnType<typeof monde>;
  let controleur: ControleurAdministration;
  const res = () => ({ setHeader: vi.fn() }) as unknown as Response & { setHeader: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    m = monde();
    controleur = new ControleurAdministration({} as ServiceAdministration, comptes, m.coordonnees);
  });

  const routes = (id: string) => [
    (r: Response, auth?: string) => controleur.lireCoordonnees(id, r, auth),
    (r: Response, auth?: string) => controleur.saisirCoordonnees(id, { ...LOGEMENT }, r, auth),
    (r: Response, auth?: string) =>
      controleur.verifierCoordonnees(id, { saisieLe: new Date().toISOString() }, r, auth),
  ];

  it("401 sans session, sur chacune des trois routes — et `no-store` déjà posé", async () => {
    const { demande } = await m.saisieParA();
    for (const route of routes(demande.id)) {
      const r = res();
      expect((await erreurDe(route(r))).statut).toBe(401);
      expect((await erreurDe(route(res(), "Bearer jeton-inconnu"))).statut).toBe(401);
      expect(r.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    }
  });

  it("403 pour un visiteur ou un partenaire, sur chacune des trois routes", async () => {
    const { demande } = await m.saisieParA();
    for (const route of routes(demande.id)) {
      for (const jeton of ["jeton-visiteur", "jeton-partenaire"]) {
        const refus = await erreurDe(route(res(), `Bearer ${jeton}`));
        expect(refus).toMatchObject({ code: "ACCES_INTERDIT", statut: 403 });
      }
    }
  });

  it("200 pour l'équipe : lecture, saisie, puis vérification par une autre personne", async () => {
    const demande = await m.logement();
    await m.demandes.accepterParPartenaire(demande.id);

    const r1 = res();
    const lue = await controleur.lireCoordonnees(demande.id, r1, "Bearer jeton-admin-a");
    expect(lue.donnees).toMatchObject({ etat: "absentes", famille: "logement", saisissable: true });
    expect(r1.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");

    const saisie = await controleur.saisirCoordonnees(demande.id, { ...LOGEMENT }, res(), "Bearer jeton-admin-a");
    expect(saisie.donnees).toMatchObject({ etat: "saisies", coordonnees: LOGEMENT, peutVerifier: false });
    expect(saisie.donnees.saisie?.par.id).toBe(ADMIN_A.id);

    const verifiee = await controleur.verifierCoordonnees(
      demande.id,
      { saisieLe: saisie.donnees.saisie!.le },
      res(),
      "Bearer jeton-admin-b",
    );
    expect(verifiee.donnees).toMatchObject({ etat: "verifiees" });
    expect(verifiee.donnees.verification?.par.id).toBe(ADMIN_B.id);
  });
});

describe("Coordonnées — statuts", () => {
  it("se saisissent et se corrigent à « acceptee » et « confirmee »", async () => {
    const m = monde();
    const demande = await m.logement();
    await m.demandes.accepterParPartenaire(demande.id);
    expect((await m.coordonnees.saisir(demande.id, LOGEMENT, ADMIN_A)).etat).toBe("saisies");

    await m.demandes.confirmer(demande.id);
    const corrigee = await m.coordonnees.saisir(demande.id, { ...LOGEMENT, adresseExacte: "ADRESSE-CORRIGEE" }, ADMIN_A);
    expect(corrigee).toMatchObject({ etat: "saisies", saisissable: true });
  });

  it("ne se saisissent ni ne se vérifient plus une fois la demande terminée", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    await m.demandes.confirmer(demande.id);
    await m.demandes.transitionner(demande.id, "terminee", "systeme");

    const lue = await m.coordonnees.lire(demande.id, ADMIN_B);
    expect(lue).toMatchObject({ statut: "terminee", etat: "saisies", saisissable: false, peutVerifier: false });

    expect(await erreurDe(m.coordonnees.saisir(demande.id, LOGEMENT, ADMIN_A))).toMatchObject({
      code: "COORDONNEES_STATUT_NON_ELIGIBLE",
      statut: 409,
    });
    expect((await erreurDe(m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B))).code).toBe(
      "COORDONNEES_STATUT_NON_ELIGIBLE",
    );
    // Rien n'a bougé : toujours la saisie de A, toujours sans vérification.
    expect((await m.depot.lire(demande.id))!.saisie?.par.id).toBe(ADMIN_A.id);
    expect((await m.depot.lire(demande.id))!.verification).toBeUndefined();
  });

  it("une saisie décidée à « confirmee » n'aboutit pas si la demande s'est terminée entre-temps", async () => {
    const m = monde();
    const { demande } = await m.saisieParA();
    await m.demandes.confirmer(demande.id);
    await m.demandes.transitionner(demande.id, "terminee", "systeme");

    expect(
      (await erreurDe(
        m.depot.saisir(demande.id, { coordonnees: LOGEMENT, parId: ADMIN_B.id, le: new Date(), statutLu: "confirmee" }),
      )).code,
    ).toBe("COORDONNEES_CONFLIT");
  });

  it("se refusent avant l'acceptation et sur une demande morte — saisie comme vérification", async () => {
    const m = monde();
    const envoyee = await m.logement();
    expect(await erreurDe(m.coordonnees.saisir(envoyee.id, LOGEMENT, ADMIN_A))).toMatchObject({
      code: "COORDONNEES_STATUT_NON_ELIGIBLE",
      statut: 409,
    });

    const morts: Array<[string, (id: string) => Promise<unknown>]> = [
      ["annulee", (id) => m.demandes.annuler(id)],
      ["expiree", (id) => m.demandes.transitionner(id, "expiree", "systeme")],
    ];
    for (const [, tuer] of morts) {
      const { demande, vue } = await m.saisieParA();
      await tuer(demande.id);
      expect((await erreurDe(m.coordonnees.saisir(demande.id, LOGEMENT, ADMIN_A))).code).toBe(
        "COORDONNEES_STATUT_NON_ELIGIBLE",
      );
      expect((await erreurDe(m.coordonnees.verifier(demande.id, vue.saisie?.le ?? "", ADMIN_B))).code).toBe(
        "COORDONNEES_STATUT_NON_ELIGIBLE",
      );
    }

    const refusee = await m.logement();
    await m.demandes.refuserParPartenaire(refusee.id, "plus-disponible");
    expect((await erreurDe(m.coordonnees.saisir(refusee.id, LOGEMENT, ADMIN_A))).code).toBe(
      "COORDONNEES_STATUT_NON_ELIGIBLE",
    );
  });

  it("refusent une demande inconnue sans rien révéler", async () => {
    const m = monde();
    expect(await erreurDe(m.coordonnees.lire("d-inexistante", ADMIN_A))).toMatchObject({
      code: "DEMANDE_INTROUVABLE",
      statut: 404,
    });
  });
});

describe("Coordonnées — logement et véhicule", () => {
  it("un logement prend adresse, téléphone, consignes", async () => {
    const m = monde();
    const { vue } = await m.saisieParA();
    expect(vue).toMatchObject({ famille: "logement", coordonnees: LOGEMENT });
  });

  it("un véhicule prend immatriculation, téléphone du chauffeur, lieu de rendez-vous", async () => {
    const m = monde();
    const demande = await m.location();
    await m.demandes.accepterParPartenaire(demande.id);
    const vue = await m.coordonnees.saisir(demande.id, VEHICULE, ADMIN_A);
    expect(vue).toMatchObject({ famille: "vehicule", coordonnees: VEHICULE });
  });

  it("refuse les champs de l'autre famille, les champs inconnus, les manques et les formes fausses", () => {
    const cas: Array<[Parameters<typeof validerCoordonnees>[0], Record<string, unknown>, string]> = [
      ["logement", { ...LOGEMENT, immatriculation: "IMMAT-TEST-01" }, "immatriculation"],
      ["vehicule", { ...VEHICULE, adresseExacte: "ADRESSE-DE-TEST" }, "adresseExacte"],
      ["logement", { ...LOGEMENT, inconnu: "x" }, "inconnu"],
      ["logement", { telephone: LOGEMENT.telephone }, "adresseExacte"],
      ["logement", { ...LOGEMENT, adresseExacte: "   " }, "adresseExacte"],
      ["logement", { ...LOGEMENT, telephone: "ADRESSE-DE-TEST" }, "telephone"],
      ["vehicule", { ...VEHICULE, immatriculation: "<script>" }, "immatriculation"],
      ["logement", { ...LOGEMENT, adresseExacte: "A".repeat(301) }, "adresseExacte"],
      ["logement", { ...LOGEMENT, telephone: 770000000 }, "telephone"],
    ];
    for (const [famille, saisie, champ] of cas) {
      let message = "";
      try {
        validerCoordonnees(famille, saisie);
      } catch (erreur) {
        const corps = (erreur as ErreurMetier).getResponse() as { code: string; message: string };
        expect(corps.code).toBe("COORDONNEES_INVALIDES");
        message = corps.message;
      }
      expect(message, champ).toContain(`« ${champ} »`);
      for (const valeur of Object.values(saisie)) {
        if (typeof valeur === "string" && valeur.trim()) expect(message).not.toContain(valeur);
      }
    }
  });

  it("nettoie les espaces et omet un champ facultatif vide", () => {
    expect(validerCoordonnees("logement", { ...LOGEMENT, adresseExacte: "  ADRESSE-DE-TEST  ", consignesArrivee: " " })).toEqual({
      adresseExacte: "ADRESSE-DE-TEST",
      telephone: LOGEMENT.telephone,
    });
  });

  it("n'en prévoit aucune pour un service à la demande", async () => {
    const m = monde();
    const demande = await m.demandes.creerService({ service: "guides", details: { zone: "Dakar" }, visiteurId: "v" });
    // Un service accepté par l'équipe.
    await m.demandes.transitionner(demande.id, "acceptee", "equipe");
    expect((await m.coordonnees.lire(demande.id, ADMIN_A)).saisissable).toBe(false);
    expect((await erreurDe(m.coordonnees.saisir(demande.id, LOGEMENT, ADMIN_A))).code).toBe(
      "COORDONNEES_GENRE_NON_PRIS_EN_CHARGE",
    );
  });
});

describe("Coordonnées — quatre yeux et invalidation", () => {
  it("la personne qui saisit ne peut pas vérifier", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    expect(vue.peutVerifier).toBe(false);
    expect((await m.coordonnees.lire(demande.id, ADMIN_B)).peutVerifier).toBe(true);

    expect(await erreurDe(m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_A))).toMatchObject({
      code: "COORDONNEES_QUATRE_YEUX",
      statut: 403,
    });
    expect((await m.coordonnees.lire(demande.id, ADMIN_A)).etat).toBe("saisies");
  });

  it("le dépôt refuse aussi, même si le service était contourné", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    expect(
      (await erreurDe(
        m.depot.verifier(demande.id, { parId: ADMIN_A.id, le: new Date(), statutLu: "acceptee", saisieLe: vue.saisie!.le }),
      )).code,
    ).toBe("COORDONNEES_CONFLIT");
  });

  it("une nouvelle saisie annule la vérification précédente — même faite par le vérificateur", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    const verifiee = await m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B);
    expect(verifiee.etat).toBe("verifiees");

    const ressaisie = await m.coordonnees.saisir(demande.id, { ...LOGEMENT, adresseExacte: "ADRESSE-CORRIGEE" }, ADMIN_B);
    expect(ressaisie.etat).toBe("saisies");
    expect(ressaisie.verification).toBeUndefined();
    expect(ressaisie.saisie?.par.id).toBe(ADMIN_B.id);
    // B a saisi : c'est maintenant à A de vérifier, et à lui seul.
    expect(ressaisie.peutVerifier).toBe(false);
    expect((await m.coordonnees.lire(demande.id, ADMIN_A)).peutVerifier).toBe(true);
  });

  it("refuse une vérification sans coordonnées, ou déjà faite", async () => {
    const m = monde();
    const demande = await m.logement();
    await m.demandes.accepterParPartenaire(demande.id);
    expect((await erreurDe(m.coordonnees.verifier(demande.id, new Date().toISOString(), ADMIN_B))).code).toBe(
      "COORDONNEES_ABSENTES",
    );

    const { demande: autre, vue } = await m.saisieParA();
    await m.coordonnees.verifier(autre.id, vue.saisie!.le, ADMIN_B);
    expect((await erreurDe(m.coordonnees.verifier(autre.id, vue.saisie!.le, { id: "admin-c" }))).code).toBe(
      "COORDONNEES_DEJA_VERIFIEES",
    );
  });

  it("refuse de vérifier des coordonnées dont on ignore qui les a saisies", async () => {
    // Une ligne ancienne : coordonnées présentes, sans trace de saisie.
    const m = monde();
    const confirmee = (await m.depotDemandes.listerPourVisiteur("visiteur-demo")).find((d) => d.statut === "confirmee")!;
    const ligne = await m.depot.lire(confirmee.id);
    expect(ligne?.coordonnees).toBeDefined();
    expect(ligne?.saisie).toBeUndefined();
    expect((await erreurDe(m.coordonnees.verifier(confirmee.id, "2026-01-01T00:00:00.000Z", ADMIN_B))).code).toBe(
      "COORDONNEES_SAISIE_NON_TRACEE",
    );
  });
});

describe("Coordonnées — concurrence et persistance", () => {
  it("une vérification fondée sur une saisie dépassée est refusée", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    // A corrige pendant que B relisait l'ancienne version.
    await new Promise((r) => setTimeout(r, 2));
    await m.coordonnees.saisir(demande.id, { ...LOGEMENT, adresseExacte: "ADRESSE-CORRIGEE" }, ADMIN_A);

    expect(await erreurDe(m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B))).toMatchObject({
      code: "COORDONNEES_CONFLIT",
      statut: 409,
    });
    expect((await m.coordonnees.lire(demande.id, ADMIN_B)).etat).toBe("saisies");
  });

  it("une saisie décidée sur un statut qui a changé n'écrit rien", async () => {
    const m = monde();
    const demande = await m.logement();
    await m.demandes.accepterParPartenaire(demande.id);
    await m.demandes.annuler(demande.id);

    // Le service a lu « acceptee » ; la demande a été annulée avant l'écriture.
    expect(
      (await erreurDe(
        m.depot.saisir(demande.id, { coordonnees: LOGEMENT, parId: ADMIN_A.id, le: new Date(), statutLu: "acceptee" }),
      )).code,
    ).toBe("COORDONNEES_CONFLIT");
    expect((await m.depot.lire(demande.id))!.coordonnees).toBeUndefined();
  });

  it("une erreur de persistance remonte telle quelle, sans valeur saisie", async () => {
    const enPanne = {
      lire: vi.fn().mockResolvedValue({ demandeId: "d-1", statut: "acceptee", famille: "logement" }),
      saisir: vi.fn().mockRejectedValue(new Error("connexion perdue")),
      verifier: vi.fn(),
    } as unknown as DepotCoordonnees;
    await expect(new ServiceCoordonnees(enPanne).saisir("d-1", LOGEMENT, ADMIN_A)).rejects.toThrow("connexion perdue");
  });

  it("le dépôt Prisma dit explicitement qu'il attend sa migration", async () => {
    const service = new ServiceCoordonnees(new DepotCoordonneesPrisma());
    for (const appel of [
      service.lire("d-1", ADMIN_A),
      service.saisir("d-1", LOGEMENT, ADMIN_A),
      service.verifier("d-1", new Date().toISOString(), ADMIN_B),
    ]) {
      expect(await erreurDe(appel)).toMatchObject({ code: "COORDONNEES_MIGRATION_EN_ATTENTE", statut: 503 });
    }
  });

  it("le module se monte, et c'est bien le dépôt en attente qui est injecté", async () => {
    // `PrismaService` remplacé par un objet vide : aucun client Prisma n'est
    // même construit, aucune connexion n'est possible — ce test ne touche pas
    // la base, il vérifie seulement l'injection.
    const module = await Test.createTestingModule({
      imports: [PrismaModule, ModuleEmail, ModuleAdministration],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(module.get(DEPOT_COORDONNEES)).toBeInstanceOf(DepotCoordonneesPrisma);
    expect(module.get(ControleurAdministration)).toBeInstanceOf(ControleurAdministration);
    await module.close();
  });
});

describe("Coordonnées — divulgation au visiteur", () => {
  /** Logement confirmé, saisi par A. */
  const confirmeeSaisie = async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    await m.demandes.confirmer(demande.id);
    return { m, demande, vue };
  };
  const visiteur = (m: ReturnType<typeof monde>, id: string) =>
    m.demandes.obtenirPourVisiteur(id, "visiteur-coordonnees");

  it("confirmée mais non vérifiée : rien", async () => {
    const { m, demande } = await confirmeeSaisie();
    expect((await visiteur(m, demande.id)).coordonnees).toBeUndefined();
  });

  it("vérifiée mais seulement acceptée : rien", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    await m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B);
    expect((await visiteur(m, demande.id)).coordonnees).toBeUndefined();
  });

  it("confirmée et vérifiée : rendues ; terminée : toujours rendues", async () => {
    const { m, demande, vue } = await confirmeeSaisie();
    await m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B);
    expect((await visiteur(m, demande.id)).coordonnees).toEqual(LOGEMENT);
    expect((await m.demandes.listerPourVisiteur("visiteur-coordonnees")).find((d) => d.id === demande.id)!.coordonnees).toEqual(LOGEMENT);

    await m.demandes.transitionner(demande.id, "terminee", "systeme");
    expect((await visiteur(m, demande.id)).coordonnees).toEqual(LOGEMENT);
  });

  it("ressaisie après vérification : retirées au visiteur jusqu'à la nouvelle vérification", async () => {
    const { m, demande, vue } = await confirmeeSaisie();
    await m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B);
    await m.coordonnees.saisir(demande.id, { ...LOGEMENT, adresseExacte: "ADRESSE-CORRIGEE" }, ADMIN_A);
    expect((await visiteur(m, demande.id)).coordonnees).toBeUndefined();
  });

  it("annulée : coordonnées et traçabilité remises à zéro", async () => {
    const { m, demande, vue } = await confirmeeSaisie();
    await m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B);
    await m.demandes.annuler(demande.id);

    const ligne = (await m.depot.lire(demande.id))!;
    expect(ligne.coordonnees).toBeUndefined();
    expect(ligne.saisie).toBeUndefined();
    expect(ligne.verification).toBeUndefined();
    expect((await visiteur(m, demande.id)).coordonnees).toBeUndefined();
  });
});

describe("Coordonnées — confidentialité hors de leur route", () => {
  it("l'export CSV n'en porte aucune, même si la demande en avait", () => {
    const avec = {
      id: "d-1",
      reference: "TW-000001",
      statut: "confirmee",
      genre: "logement",
      creeLe: "2026-10-17T10:00:00.000Z",
      misAJourLe: "2026-10-17T10:00:00.000Z",
      offre: { genre: "logement", logementId: "l-1", titre: "Villa", vignette: "/v.jpg" },
      dates: { debut: "2026-11-01", fin: "2026-11-05" },
      personnes: 2,
      prix: { total: 1 },
      frise: [],
      visiteur: { id: "v-1" },
      coordonnees: LOGEMENT,
    } as unknown as DemandeAdmin;
    const csv = composerCsv([avec]);
    for (const valeur of Object.values(LOGEMENT)) expect(csv).not.toContain(valeur);
  });

  it("la réponse au partenaire n'en porte aucune, même vérifiées", async () => {
    const m = monde();
    const { demande, vue } = await m.saisieParA();
    await m.coordonnees.verifier(demande.id, vue.saisie!.le, ADMIN_B);
    const jetons = {
      parValeur: async () => ({ jeton: "j", demandeId: demande.id, etat: "valide", expireLe: "2099-01-01T00:00:00.000Z" }),
    } as unknown as DepotJetons;

    const reponse = await new ServiceReponses(jetons, m.demandes).ouvrir("j");
    const texte = JSON.stringify(reponse);
    for (const valeur of Object.values(LOGEMENT)) expect(texte).not.toContain(valeur);
  });

  it("aucun modèle d'e-mail ne lit de coordonnées", () => {
    const dossier = join(__dirname, "../../commun/email/modeles");
    for (const fichier of readdirSync(dossier)) {
      const source = readFileSync(join(dossier, fichier), "utf8");
      expect(source, fichier).not.toMatch(/coordonnees|adresseExacte|telephoneChauffeur|immatriculation/);
    }
  });

  it("aucun journal applicatif ne cite une coordonnée", () => {
    for (const fichier of ["coordonnees.service.ts", "coordonnees.fixtures.ts", "coordonnees.prisma.ts", "administration.controller.ts"]) {
      const source = readFileSync(join(__dirname, fichier), "utf8");
      expect(source, fichier).not.toMatch(/logger\.|console\./);
    }
  });

  it("la démonstration ne rend aucune coordonnée non vérifiée", async () => {
    const m = monde();
    for (const demande of await m.depotDemandes.listerPourVisiteur("visiteur-demo")) {
      expect((demande as Demande).coordonnees, demande.id).toBeUndefined();
    }
  });
});
