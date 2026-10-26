import { afterEach, describe, expect, it, vi } from "vitest";
import type { Demande } from "@teranga/contracts";

import { config } from "../../config/configuration";
import { ControleurDemandes } from "./demandes.controller";

/**
 * Ce que le contrôleur dit à l'écran de confirmation : l'e-mail est-il
 * réellement parti, et un paiement est-il réellement annoncé ?
 */
const DEMANDE = {
  id: "d-1",
  reference: "TW-111111",
  statut: "envoyee",
  offre: { genre: "logement", logementId: "l-1", titre: "Villa", vignette: "" },
  dates: { debut: "2026-11-10", fin: "2026-11-14" },
  personnes: 2,
  prix: { total: 620000 },
  frise: [],
} as unknown as Demande;

function controleur(envoye: boolean, logement: unknown = { quartier: "Almadies", ville: "Dakar" }) {
  const email = {
    envoyerConfirmationDemande: vi.fn().mockResolvedValue({ envoye }),
    alerterEquipe: vi.fn().mockResolvedValue(undefined),
    envoyerDemandeAuPartenaire: vi.fn().mockResolvedValue(undefined),
  };
  const demandes = {
    creerLogement: vi.fn().mockResolvedValue(DEMANDE),
    emettreJetonReponse: vi.fn().mockResolvedValue(null),
  };
  const comptes = {
    visiteurPourDemande: vi.fn().mockResolvedValue({ compteId: "c-1", email: "a@b.sn" }),
    adressesEquipe: vi.fn().mockResolvedValue([]),
    emettreLienDemande: vi.fn().mockResolvedValue({ jeton: "twl_x", expireLe: "" }),
  };
  // Le catalogue : le contrôleur n'y lit que le lieu, pour la suite du séjour.
  const logements = {
    parId: vi.fn().mockImplementation(async () => {
      if (!logement) throw new Error("introuvable");
      return logement;
    }),
  };
  const c = new ControleurDemandes(demandes as never, comptes as never, email as never, logements as never);
  const creer = () =>
    c.creerLogement({ logementId: "l-1", debut: "2026-11-10", fin: "2026-11-14", personnes: 2, contact: { email: "a@b.sn" } } as never);
  return { creer, email };
}

describe("Notification renvoyée avec la demande", () => {
  const acompteInitial = { ...config.acompte };
  afterEach(() => Object.assign(config.acompte, acompteInitial));

  it("acompte fermé : e-mail parti, aucun paiement annoncé", async () => {
    expect(config.acompte.actif).toBe(false);
    const { creer, email } = controleur(true);
    const res = await creer();
    expect(res.notification).toEqual({ emailEnvoye: true, acompteAnnonce: false, jetonSuite: expect.any(String) });
    expect(email.envoyerConfirmationDemande.mock.calls[0][1].acompte).toBeUndefined();
    expect(email.envoyerConfirmationDemande.mock.calls[0][1].lienAcces.url).toContain("/fr/acces-demande/twl_x");
  });

  it("n'affirme pas l'envoi quand l'e-mail échoue", async () => {
    const { creer } = controleur(false);
    expect((await creer()).notification).toEqual({ emailEnvoye: false, acompteAnnonce: false, jetonSuite: expect.any(String) });
  });

  it("acompte ouvert : le paiement n'est annoncé que si l'e-mail l'annonce", async () => {
    Object.assign(config.acompte, { actif: true, pourcentage: 30 });
    const { creer, email } = controleur(true);
    const res = await creer();
    expect(email.envoyerConfirmationDemande.mock.calls[0][1].acompte).toBeDefined();
    expect(res.notification.acompteAnnonce).toBe(true);
  });

  it("annonce dans l'e-mail les seuls moyens configurés", async () => {
    Object.assign(config.acompte, {
      actif: true,
      pourcentage: 30,
      etatCoordonnees: "defini",
      beneficiaire: { titulaire: "T", banque: "B", iban: "IBANDETESTNEPASUTILISER", bic: "BICDETEST" },
      moyens: ["virement", "wave"],
      mobileMoney: [{ operateur: "wave", numero: "+221000000000", titulaire: "TW" }],
    });
    const { creer, email } = controleur(true);
    await creer();
    expect(email.envoyerConfirmationDemande.mock.calls[0][1].acompte.moyens).toEqual(["virement", "wave"]);
  });
});

describe("Suite du séjour jointe à l'accusé de réception", () => {
  it("propose l'arrivée et le retour, du lieu du logement", async () => {
    const { creer, email } = controleur(true);
    await creer();

    const { suite } = email.envoyerConfirmationDemande.mock.calls[0][1];
    expect(suite.lieu).toBe("Almadies, Dakar");

    const arrivee = new URL(suite.arrivee).searchParams;
    expect(arrivee.get("depart")).toBe("Aéroport AIBD");
    expect(arrivee.get("arrivee")).toBe("Almadies, Dakar");
    expect(arrivee.get("quand")).toBe("2026-11-10T10:00");

    const depart = new URL(suite.depart).searchParams;
    expect(depart.get("depart")).toBe("Almadies, Dakar");
    expect(depart.get("arrivee")).toBe("Aéroport AIBD");
    expect(depart.get("quand")).toBe("2026-11-14T08:00");
    expect(depart.get("passagers")).toBe("2");
  });

  it("n'invente pas un lieu : sans logement retrouvé, la section disparaît", async () => {
    const { creer, email } = controleur(true, null);
    await creer();
    expect(email.envoyerConfirmationDemande.mock.calls[0][1].suite).toBeUndefined();
  });

  it("n'envoie jamais l'accusé en échec à cause du catalogue", async () => {
    // Le catalogue qui tombe ne doit pas empêcher l'accusé de partir.
    const { creer, email } = controleur(true, null);
    await expect(creer()).resolves.toBeDefined();
    expect(email.envoyerConfirmationDemande).toHaveBeenCalledTimes(1);
  });
});
