import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import { jetonSuiteDemande, jetonSuiteValide } from "../../commun/securite/hachage";
import type { Demande } from "@teranga/contracts";
import { ControleurDemandes } from "./demandes.controller";
import { DepotDemandesFixtures } from "./demandes.fixtures";
import { ServiceDemandes } from "./demandes.service";

/**
 * « Voulez-vous qu'on vienne vous chercher à l'aéroport ? »
 *
 * La question est posée une fois la demande de logement partie, à un visiteur
 * qui n'a ni session ni code. Ce que ces tests tiennent :
 *
 *   le jeton — sans lui, rien n'est écrit et personne n'est prévenu : une
 *   référence devinée ne doit pas suffire à faire écrire à un inconnu ;
 *
 *   l'honnêteté — l'écran ne dit « un e-mail vous sera envoyé » que s'il est
 *   réellement parti ;
 *
 *   la sobriété — un même « oui » renvoyé deux fois n'écrit pas deux fois.
 */

/** Une `ErreurMetier` porte son code dans le corps de sa réponse HTTP. */
const erreurAvecCode = (code: string) => (erreur: unknown) =>
  erreur instanceof ErreurMetier && (erreur.getResponse() as { code?: string }).code === code;

describe("Jeton de suite de demande", () => {
  it("est propre à la demande qu'il désigne", () => {
    const jeton = jetonSuiteDemande("d-1");
    expect(jetonSuiteValide("d-1", jeton)).toBe(true);
    // Le jeton d'une demande ne vaut rien pour une autre.
    expect(jetonSuiteValide("d-2", jeton)).toBe(false);
  });

  it("est stable et de la longueur attendue par la validation", () => {
    expect(jetonSuiteDemande("d-1")).toBe(jetonSuiteDemande("d-1"));
    expect(jetonSuiteDemande("d-1")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuse tout ce qui n'est pas lui, sans lever", () => {
    for (const faux of [undefined, null, "", "abc", 123, {}, "0".repeat(64), jetonSuiteDemande("d-1") + "0"]) {
      expect(jetonSuiteValide("d-1", faux), String(faux)).toBe(false);
    }
  });

  it("ne vaut rien avec une autre clé : une signature d'ailleurs n'ouvre pas ici", () => {
    const ailleurs = jetonSuiteDemande("d-1", "une-autre-cle-secrete");
    expect(jetonSuiteValide("d-1", ailleurs)).toBe(false);
  });
});

describe("ServiceDemandes — choisir le transfert", () => {
  async function creerService() {
    const module = await Test.createTestingModule({
      providers: [ServiceDemandes, { provide: DEPOT_DEMANDES, useClass: DepotDemandesFixtures }],
    }).compile();
    return module.get(ServiceDemandes);
  }

  const logement = (service: ServiceDemandes) =>
    service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-01",
      fin: "2026-11-08",
      personnes: 2,
      visiteurId: "visiteur-demo",
    });

  it("enregistre la réponse sur la demande", async () => {
    const service = await creerService();
    const demande = await logement(service);
    expect(demande.transfert).toBeUndefined();

    const resultat = await service.choisirTransfert(demande.id, "souhaite");
    expect(resultat.demande.transfert).toBe("souhaite");
    expect(resultat.avant).toBeUndefined();
    expect((await service.obtenir(demande.id)).transfert).toBe("souhaite");
  });

  it("rend l'ancien choix, pour qu'on sache si quelque chose a changé", async () => {
    const service = await creerService();
    const demande = await logement(service);

    await service.choisirTransfert(demande.id, "refuse");
    expect((await service.choisirTransfert(demande.id, "souhaite")).avant).toBe("refuse");
    expect((await service.choisirTransfert(demande.id, "souhaite")).avant).toBe("souhaite");
  });

  it("refuse une demande qui n'est pas un logement", async () => {
    const service = await creerService();
    const transport = await service.creerVehicule({
      vehiculeId: "v-001",
      prestation: "trajet",
      depart: "Aéroport AIBD",
      quand: new Date(Date.now() + 6 * 3600_000).toISOString(),
      passagers: 2,
      bagages: 1,
      visiteurId: "visiteur-demo",
    });

    await expect(service.choisirTransfert(transport.id, "souhaite")).rejects.toSatisfy(erreurAvecCode("TRANSFERT_NON_APPLICABLE"));
  });

  it("refuse une demande qui n'est plus en cours", async () => {
    const service = await creerService();
    const demande = await logement(service);
    await service.refuserParPartenaire(demande.id, "plus-disponible");

    await expect(service.choisirTransfert(demande.id, "souhaite")).rejects.toSatisfy(erreurAvecCode("DEMANDE_CLOSE"));
  });

  it("refuse une demande qui n'existe pas", async () => {
    const service = await creerService();
    await expect(service.choisirTransfert("d-inconnue", "souhaite")).rejects.toThrow(ErreurMetier);
  });
});

describe("Route du transfert — jeton, e-mails, honnêteté", () => {
  const DEMANDE = {
    id: "d-9",
    reference: "TW-424242",
    statut: "envoyee",
    offre: { genre: "logement", logementId: "l-1", titre: "Villa cinq chambres à Somone", vignette: "" },
    dates: { debut: "2026-11-10", fin: "2026-11-14" },
    personnes: 3,
    prix: { total: 620000 },
    frise: [],
  } as unknown as Demande;

  /** Un contrôleur dont tout ce qui écrit ou envoie est observable. */
  function montage(options: { avant?: "souhaite" | "refuse"; emailVisiteur?: boolean; contact?: object } = {}) {
    const email = {
      envoyerConfirmationTransfert: vi.fn().mockResolvedValue({ envoye: options.emailVisiteur ?? true }),
      alerterTransfert: vi.fn().mockResolvedValue({ envoye: true }),
    };
    const demandes = {
      choisirTransfert: vi.fn().mockResolvedValue({
        demande: DEMANDE,
        avant: options.avant,
        contact: options.contact ?? { email: "fatou@exemple.sn", nom: "Fatou Ndiaye", telephone: "221771234567" },
      }),
    };
    const comptes = { adressesEquipe: vi.fn().mockResolvedValue(["equipe@teranga.sn"]) };
    const logements = { parId: vi.fn().mockResolvedValue({ quartier: "Centre", ville: "Somone" }) };
    const controleur = new ControleurDemandes(
      demandes as never,
      comptes as never,
      email as never,
      logements as never,
    );
    const repondre = (choix: "souhaite" | "refuse", jeton = jetonSuiteDemande("d-9")) =>
      controleur.choisirTransfert("d-9", { choix, jeton });
    return { repondre, email, demandes };
  }

  it("sans jeton valide : rien n'est écrit, personne n'est prévenu", async () => {
    const { repondre, email, demandes } = montage();

    for (const faux of ["", "x".repeat(64), jetonSuiteDemande("une-autre-demande")]) {
      await expect(repondre("souhaite", faux), faux).rejects.toSatisfy(erreurAvecCode("ACCES_INTERDIT"));
    }
    expect(demandes.choisirTransfert).not.toHaveBeenCalled();
    expect(email.envoyerConfirmationTransfert).not.toHaveBeenCalled();
    expect(email.alerterTransfert).not.toHaveBeenCalled();
  });

  it("« oui » : confirme au visiteur et prévient l'équipe", async () => {
    const { repondre, email } = montage();
    const res = await repondre("souhaite");

    expect(res.donnees).toEqual({ transfert: "souhaite", emailEnvoye: true });

    const [adresse, visiteur] = email.envoyerConfirmationTransfert.mock.calls[0];
    expect(adresse).toBe("fatou@exemple.sn");
    expect(visiteur.reference).toBe("TW-424242");
    expect(visiteur.lieu).toBe("Centre, Somone");
    expect(visiteur.jour).toBe("10 novembre 2026");
    // La référence voyage dans le message WhatsApp : l'équipe retrouve la demande.
    expect(decodeURIComponent(visiteur.lienWhatsapp)).toContain("TW-424242");
    // Le visiteur peut aussi choisir lui-même : recherche déjà remplie.
    expect(new URL(visiteur.lienVehicules).searchParams.get("arrivee")).toBe("Centre, Somone");

    const [destinataires, equipe] = email.alerterTransfert.mock.calls[0];
    expect(destinataires).toEqual(["equipe@teranga.sn"]);
    expect(equipe.contact.telephone).toBe("221771234567");
    expect(equipe.lien).toContain("/admin/demandes/d-9");
  });

  it("n'affirme pas l'e-mail quand il n'est pas parti, et l'équipe est prévenue quand même", async () => {
    const { repondre, email } = montage({ emailVisiteur: false });
    const res = await repondre("souhaite");

    // L'écran ne dira pas « un e-mail vous sera envoyé » : il dira que l'équipe
    // le contactera — ce qui est vrai, puisque l'alerte est partie.
    expect(res.donnees.emailEnvoye).toBe(false);
    expect(email.alerterTransfert).toHaveBeenCalledTimes(1);
  });

  it("sans adresse e-mail connue, ne prétend pas avoir écrit", async () => {
    const { repondre, email } = montage({ contact: { nom: "Fatou" } });
    const res = await repondre("souhaite");

    expect(res.donnees.emailEnvoye).toBe(false);
    expect(email.envoyerConfirmationTransfert).not.toHaveBeenCalled();
    expect(email.alerterTransfert).toHaveBeenCalledTimes(1);
  });

  it("le même « oui » renvoyé ne réécrit à personne", async () => {
    // Un double clic, un rechargement : un seul e-mail au visiteur, une seule alerte.
    const { repondre, email } = montage({ avant: "souhaite" });
    const res = await repondre("souhaite");

    expect(res.donnees).toEqual({ transfert: "souhaite", emailEnvoye: false });
    expect(email.envoyerConfirmationTransfert).not.toHaveBeenCalled();
    expect(email.alerterTransfert).not.toHaveBeenCalled();
  });

  it("un « oui » après un « non » écrit de nouveau : il redemande vraiment", async () => {
    const { repondre, email } = montage({ avant: "refuse" });
    await repondre("souhaite");

    expect(email.envoyerConfirmationTransfert).toHaveBeenCalledTimes(1);
    expect(email.alerterTransfert).toHaveBeenCalledTimes(1);
  });

  it("« non » : enregistré, et personne n'est dérangé", async () => {
    const { repondre, email, demandes } = montage();
    const res = await repondre("refuse");

    expect(res.donnees).toEqual({ transfert: "refuse", emailEnvoye: false });
    expect(demandes.choisirTransfert).toHaveBeenCalledWith("d-9", "refuse");
    expect(email.envoyerConfirmationTransfert).not.toHaveBeenCalled();
    expect(email.alerterTransfert).not.toHaveBeenCalled();
  });
});
