import { afterEach, describe, expect, it, vi } from "vitest";

import { ErreurMetier } from "../../commun/erreurs";
import { genererEmailDemande } from "../../commun/email/modeles/demande.modele";
import { enProduction } from "../../commun/securite/posture.test-utils";
import { DepotComptesFixtures } from "./comptes.fixtures";
import { DUREE_LIEN_DEMANDE_HEURES, ServiceComptes } from "./comptes.service";

/**
 * Le lien d'accès à une demande : un jeton imprévisible, à usage unique, limité
 * dans le temps, qui ramène son destinataire à **sa** demande et à rien d'autre.
 */
/** Le code métier d'une ErreurMetier, que l'exception porte dans sa réponse. */
const codeDe = (erreur: unknown) =>
  ((erreur as ErreurMetier).getResponse() as { code: string }).code;

async function refus(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
  } catch (erreur) {
    return codeDe(erreur);
  }
  return "AUCUN_REFUS";
}

describe("Lien d'accès à une demande", () => {
  afterEach(() => vi.useRealTimers());

  async function emettre(email = "fatou@exemple.sn", demandeId = "d-1") {
    const depot = new DepotComptesFixtures();
    const comptes = new ServiceComptes(depot);
    const visiteur = await comptes.visiteurPourDemande(undefined, { email });
    const lien = await comptes.emettreLienDemande({
      compteId: visiteur.compteId,
      email,
      demandeId,
    });
    return { comptes, depot, visiteur, lien };
  }

  it("émet un jeton imprévisible, différent à chaque fois", async () => {
    const { comptes, visiteur, lien } = await emettre();
    const autre = await comptes.emettreLienDemande({
      compteId: visiteur.compteId,
      email: "fatou@exemple.sn",
      demandeId: "d-1",
    });
    expect(lien.jeton).toMatch(/^twl_[0-9a-f]{64}$/);
    expect(autre.jeton).not.toBe(lien.jeton);
  });

  it("ouvre une session et désigne la demande de son destinataire", async () => {
    await enProduction(async () => {
      const { comptes, lien } = await emettre("fatou@exemple.sn", "d-42");
      const ouverture = await comptes.ouvrirParLienDemande(lien.jeton, "1.2.3.4");

      expect(ouverture.demandeId).toBe("d-42");
      expect(ouverture.token).toBeTruthy();
      // La session obtenue est bien celle du destinataire.
      await expect(comptes.exigerVisiteur(ouverture.token)).resolves.toBeTruthy();
    });
  });

  it("ne sert qu'une fois", async () => {
    await enProduction(async () => {
      const { comptes, lien } = await emettre();
      await comptes.ouvrirParLienDemande(lien.jeton, "1.2.3.4");
      expect(await refus(comptes.ouvrirParLienDemande(lien.jeton, "1.2.3.4"))).toBe("LIEN_DEJA_UTILISE");
    });
  });

  it("expire après la durée prévue", async () => {
    await enProduction(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
      const { comptes, lien } = await emettre();

      vi.setSystemTime(new Date(Date.now() + (DUREE_LIEN_DEMANDE_HEURES * 60 + 1) * 60_000));
      expect(await refus(comptes.ouvrirParLienDemande(lien.jeton, "1.2.3.4"))).toBe("LIEN_EXPIRE");
    });
  });

  it("reste valable juste avant l'échéance", async () => {
    await enProduction(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
      const { comptes, lien } = await emettre();

      vi.setSystemTime(new Date(Date.now() + (DUREE_LIEN_DEMANDE_HEURES * 60 - 1) * 60_000));
      await expect(comptes.ouvrirParLienDemande(lien.jeton, "1.2.3.4")).resolves.toBeTruthy();
    });
  });

  it("refuse un jeton inventé ou mal formé, sans rien révéler", async () => {
    await enProduction(async () => {
      const { comptes } = await emettre();
      for (const faux of ["", "abc", "twl_" + "0".repeat(64), "d-1", "fatou@exemple.sn"]) {
        await expect(comptes.ouvrirParLienDemande(faux, "1.2.3.4")).rejects.toBeInstanceOf(ErreurMetier);
      }
    });
  });

  it("ne mène jamais à la demande d'un autre visiteur", async () => {
    await enProduction(async () => {
      const depot = new DepotComptesFixtures();
      const comptes = new ServiceComptes(depot);
      const fatou = await comptes.visiteurPourDemande(undefined, { email: "fatou@exemple.sn" });
      const amadou = await comptes.visiteurPourDemande(undefined, { email: "amadou@exemple.sn" });
      const lienFatou = await comptes.emettreLienDemande({
        compteId: fatou.compteId,
        email: "fatou@exemple.sn",
        demandeId: "demande-de-fatou",
      });
      await comptes.emettreLienDemande({
        compteId: amadou.compteId,
        email: "amadou@exemple.sn",
        demandeId: "demande-d-amadou",
      });

      const ouverture = await comptes.ouvrirParLienDemande(lienFatou.jeton, "1.2.3.4");
      expect(ouverture.demandeId).toBe("demande-de-fatou");
      const session = await depot.sessionVisiteur(ouverture.token);
      expect(session?.email).toBe("fatou@exemple.sn");
    });
  });

  it("freine les essais répétés depuis une même adresse", async () => {
    await enProduction(async () => {
      const { comptes } = await emettre();
      for (let i = 0; i < 20; i++) {
        await comptes.ouvrirParLienDemande("twl_" + "a".repeat(64), "9.9.9.9").catch(() => {});
      }
      expect(await refus(comptes.ouvrirParLienDemande("twl_" + "b".repeat(64), "9.9.9.9"))).toBe("TROP_DE_TENTATIVES");
    });
  });
});

describe("E-mail de confirmation — le lien", () => {
  const base = { reference: "TW-123456", titre: "Villa Almadies", urlSite: "https://exemple.sn" };

  it("porte le lien, sa durée et l'avertissement quand il existe", () => {
    const mail = genererEmailDemande({
      ...base,
      lienAcces: { url: "https://exemple.sn/fr/acces-demande/twl_x", validiteHeures: 24 },
    });
    expect(mail.html).toContain("https://exemple.sn/fr/acces-demande/twl_x");
    expect(mail.html).toContain("Accéder à ma demande");
    expect(mail.texte).toContain("https://exemple.sn/fr/acces-demande/twl_x");
    expect(mail.texte).toContain("24 heures");
    expect(mail.texte).toContain("pas une réservation confirmée");
  });

  it("ne promet aucun lien quand il n'a pas pu être émis", () => {
    const mail = genererEmailDemande(base);
    expect(mail.html).not.toContain("acces-demande");
    expect(mail.texte).not.toContain("lien sécurisé");
  });
});
