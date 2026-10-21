import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resend } from "resend";

import { ServiceEmail } from "./email.service";
import { genererAlerteDemande, type AlerteDemande } from "./modeles/demande-equipe.modele";

/**
 * L'alerte interne, et ce qu'elle doit garantir.
 *
 * Elle existe parce qu'une demande pouvait arriver sans que personne ne le
 * sache : elle se rangeait en base, et les deux heures de réponse de l'hôte
 * s'écoulaient en silence. Ce qui est vérifié ici tient en trois points — elle
 * part à toute l'équipe, elle ne fait jamais tomber la demande, et elle ne
 * reste jamais muette quand elle n'a personne à prévenir.
 */

const ALERTE: AlerteDemande = {
  reference: "TW-784188",
  genre: "logement",
  titre: "Villa trois chambres avec grande piscine à Nguérigne",
  sejour: "1 novembre 2026 → 8 novembre 2026",
  personnes: 4,
  total: "1 050 000 FCFA",
  message: "Arrivée vers 14h, nous venons de l'aéroport.",
  repondreAvant: "20 octobre à 22:36",
  contact: { nom: "Fatou Ndiaye", email: "fatou@exemple.sn", telephone: "+221 77 123 45 67" },
  lien: "https://teranga-way.com/fr/admin/demandes/d-123",
};

describe("Alerte équipe — le contenu", () => {
  it("porte de quoi décider sans ouvrir le backoffice", () => {
    const { sujet, texte, html } = genererAlerteDemande(ALERTE);

    // Le sujet se lit dans une liste de messages, sans ouvrir.
    expect(sujet).toContain("TW-784188");
    expect(sujet).toContain("Villa trois chambres");

    for (const attendu of [
      "TW-784188",
      "1 050 000 FCFA",
      "fatou@exemple.sn",
      "+221 77 123 45 67",
      "Fatou Ndiaye",
      "22:36",
      "https://teranga-way.com/fr/admin/demandes/d-123",
    ]) {
      expect(texte, attendu).toContain(attendu);
      expect(html, attendu).toContain(attendu);
    }
  });

  it("échappe ce que le visiteur a écrit", () => {
    const { html } = genererAlerteDemande({
      ...ALERTE,
      message: '<script>alert("xss")</script>',
      contact: { ...ALERTE.contact, nom: "Fatou <b>N</b>" },
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Fatou &lt;b&gt;N&lt;/b&gt;");
  });

  it("se contente de ce qu'on lui donne", () => {
    // Un service à la demande n'a ni séjour, ni total, ni message.
    const { texte } = genererAlerteDemande({
      reference: "TW-000001",
      genre: "restauration",
      titre: "Restauration",
      contact: { email: "fatou@exemple.sn" },
      lien: "https://teranga-way.com/fr/admin/demandes/d-9",
    });

    expect(texte).toContain("TW-000001");
    expect(texte).not.toContain("Total");
    expect(texte).not.toContain("undefined");
  });
});

describe("Alerte équipe — l'envoi", () => {
  const envoyer = vi.fn();
  const resend = { emails: { send: envoyer } } as unknown as Resend;
  const service = new ServiceEmail(resend);

  beforeEach(() => vi.clearAllMocks());

  it("part à toute l'équipe, sans doublon ni casse", async () => {
    envoyer.mockResolvedValueOnce({ data: { id: "msg-1" }, error: null });

    const resultat = await service.alerterEquipe(
      ["terangaway@gmail.com", " TerangaWay@gmail.com ", "vantasec81@gmail.com"],
      ALERTE,
    );

    expect(resultat.envoye).toBe(true);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0][0].to).toEqual([
      "terangaway@gmail.com",
      "vantasec81@gmail.com",
    ]);
  });

  it("ne lève jamais : la demande est déjà enregistrée", async () => {
    envoyer.mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });
    await expect(service.alerterEquipe(["terangaway@gmail.com"], ALERTE)).resolves.toEqual({
      envoye: false,
    });

    envoyer.mockRejectedValueOnce(new Error("réseau coupé"));
    await expect(service.alerterEquipe(["terangaway@gmail.com"], ALERTE)).resolves.toEqual({
      envoye: false,
    });
  });

  it("sans destinataire, n'envoie rien et le dit", async () => {
    const resultat = await service.alerterEquipe([], ALERTE);

    expect(resultat.envoye).toBe(false);
    expect(envoyer).not.toHaveBeenCalled();
  });
});
