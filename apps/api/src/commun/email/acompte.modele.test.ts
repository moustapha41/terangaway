import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Resend } from "resend";
import { describe, expect, it, vi } from "vitest";

import { ServiceEmail } from "./email.service";
import { genererEmailInstructionsAcompte, type InstructionsAcompte } from "./modeles/acompte.modele";
import { genererEmailDemande } from "./modeles/demande.modele";

/**
 * Les écrits de l'acompte : les instructions de virement, et l'accusé de
 * demande qui n'a plus le droit de promettre « aucun paiement » quand un
 * acompte va être demandé.
 *
 * Les coordonnées sont des sentinelles de test — les mêmes que celles de
 * `configuration.test.ts` — qui ne ressemblent à aucun compte réel.
 */
const INSTRUCTIONS: InstructionsAcompte = {
  reference: "TW-123456",
  titre: "Villa trois chambres à Saly",
  total: "620 000 FCFA",
  acompte: "186 000 FCFA",
  pourcentage: 30,
  echeance: "2 novembre à 08:00",
  beneficiaire: {
    titulaire: "TITULAIRE-DE-TEST",
    banque: "BANQUE-DE-TEST",
    iban: "IBANDETESTNEPASUTILISER",
    bic: "BICDETEST",
  },
};

describe("E-mail d'instructions d'acompte — le contenu", () => {
  it("porte référence, total, acompte, compte, motif et échéance", () => {
    const { sujet, texte, html } = genererEmailInstructionsAcompte(INSTRUCTIONS);
    expect(sujet).toContain("TW-123456");

    for (const attendu of [
      "TW-123456",
      "620 000 FCFA",
      "186 000 FCFA",
      "30 %",
      "2 novembre à 08:00",
      "TITULAIRE-DE-TEST",
      "BANQUE-DE-TEST",
      "IBAN DETE STNE PASU TILI SER",
      "BICDETEST",
      "Motif à inscrire",
    ]) {
      expect(texte, attendu).toContain(attendu);
      expect(html.replace(/&nbsp;/g, " "), attendu).toContain(attendu);
    }
  });

  it("ne dit jamais que le paiement est reçu : seulement qu'il le sera après vérification", () => {
    const { texte } = genererEmailInstructionsAcompte(INSTRUCTIONS);
    expect(texte).toContain("n'est considéré comme reçu qu'après vérification");
    expect(texte).not.toMatch(/paiement (a été |est )?(bien )?reçu\b/i);
    expect(texte).not.toMatch(/\bconfirmé\b/i);
  });

  it("dit quoi faire en cas de paiement déjà fait, de difficulté, ou de coordonnées suspectes", () => {
    const { texte } = genererEmailInstructionsAcompte(INSTRUCTIONS);
    expect(texte).toContain("Vous avez déjà payé, ou vous rencontrez une difficulté");
    expect(texte).toContain("Ces coordonnées ne changent jamais par e-mail");
  });

  it("échappe le titre de l'offre", () => {
    const { html } = genererEmailInstructionsAcompte({ ...INSTRUCTIONS, titre: "<script>x</script>" });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("n'écrit aucune coordonnée bancaire en dur", () => {
    const source = readFileSync(join(__dirname, "modeles", "acompte.modele.ts"), "utf8");
    // La forme d'un IBAN : deux lettres de pays, deux chiffres de clé, la suite.
    expect(source).not.toMatch(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/);
    expect(source).not.toMatch(/process\.env/);
  });
});

describe("E-mail d'accusé de demande — l'annonce de l'acompte", () => {
  const base = { reference: "TW-123456", titre: "Villa", urlSite: "https://exemple.test" };

  it("garde « aucun paiement » quand aucun acompte ne sera demandé", () => {
    const { texte, html } = genererEmailDemande(base);
    expect(texte).toContain("jamais avant la prestation");
    expect(html).toContain("Aucun paiement");
  });

  it("annonce l'acompte sans promettre l'absence de paiement ni prétendre à une réception", () => {
    const { texte, html } = genererEmailDemande({ ...base, acompte: { pourcentage: 30, delaiHeures: 12 } });

    expect(texte).not.toContain("jamais avant la prestation");
    expect(html).not.toContain("Aucun paiement");
    expect(texte).toContain("Rien n'est payé pour l'instant");
    expect(texte).toContain("30 % du total");
    expect(texte).toContain("12 heures");
    expect(texte).toContain("n'est considéré comme reçu qu'après vérification");
    expect(html.replace(/&nbsp;/g, " ").replace(/\s+/g, " ")).toContain("qu'après vérification");
  });
});

describe("ServiceEmail — envoi des instructions, erreurs et tentatives", () => {
  const client = (...reponses: Array<unknown | Error>) => {
    const send = vi.fn();
    for (const reponse of reponses) {
      if (reponse instanceof Error) send.mockRejectedValueOnce(reponse);
      else send.mockResolvedValueOnce(reponse);
    }
    return { service: new ServiceEmail({ emails: { send } } as unknown as Resend), send };
  };
  const options = { cleIdempotence: "acompte-instructions-a1", pauses: [0, 0] };
  const ok = { data: { id: "em_1" }, error: null };
  const erreur = (name: string) => ({ data: null, error: { name, message: name, statusCode: 500 } });

  it("envoie une fois, avec la clé d'idempotence", async () => {
    const { service, send } = client(ok);
    expect(await service.envoyerInstructionsAcompte("Visiteur@Test.local", INSTRUCTIONS, options)).toEqual({
      envoye: true,
      tentatives: 1,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("visiteur@test.local");
    expect(send.mock.calls[0][1]).toEqual({ idempotencyKey: "acompte-instructions-a1" });
  });

  it("réessaie une panne passagère avec la même clé", async () => {
    const { service, send } = client(erreur("rate_limit_exceeded"), new Error("ECONNRESET"), ok);
    const resultat = await service.envoyerInstructionsAcompte("v@test.local", INSTRUCTIONS, options);
    expect(resultat).toEqual({ envoye: true, tentatives: 3 });
    expect(send.mock.calls.map((appel) => appel[1].idempotencyKey)).toEqual([
      "acompte-instructions-a1",
      "acompte-instructions-a1",
      "acompte-instructions-a1",
    ]);
  });

  it("ne réessaie pas un refus définitif", async () => {
    const { service, send } = client(erreur("validation_error"));
    const resultat = await service.envoyerInstructionsAcompte("v@test.local", INSTRUCTIONS, options);
    expect(resultat).toMatchObject({ envoye: false, tentatives: 1 });
    expect(resultat.erreur).toContain("validation_error");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("rend l'échec après la dernière tentative, sans lever", async () => {
    const { service, send } = client(
      erreur("internal_server_error"),
      erreur("internal_server_error"),
      erreur("internal_server_error"),
    );
    const resultat = await service.envoyerInstructionsAcompte("v@test.local", INSTRUCTIONS, options);
    expect(resultat).toMatchObject({ envoye: false, tentatives: 3 });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("sans Resend, n'envoie rien et le dit", async () => {
    const resultat = await new ServiceEmail().envoyerInstructionsAcompte("v@test.local", INSTRUCTIONS, options);
    expect(resultat).toEqual({ envoye: false, tentatives: 0, erreur: "resend_non_configure" });
  });
});


describe("Accusé de demande — le moyen annoncé suit la configuration", () => {
  const base = { reference: "TW-123456", titre: "Villa", urlSite: "https://exemple.sn" };
  const avec = (moyens?: readonly ("virement" | "wave" | "orange-money")[]) =>
    genererEmailDemande({ ...base, acompte: { pourcentage: 30, delaiHeures: 12, moyens } });
  const texte = (m: { texte: string }) => m.texte.replace(/\s+/g, " ");

  it("annonce le virement seul quand rien n'est précisé (comportement historique)", () => {
    expect(texte(avec())).toContain("par virement bancaire, à régler sous 12 heures");
  });

  it("n'annonce que les moyens réellement configurés", () => {
    expect(texte(avec(["wave"]))).toContain("par Wave, à régler");
    expect(texte(avec(["wave"]))).not.toContain("virement");
    expect(texte(avec(["virement", "wave"]))).toContain("par virement bancaire ou Wave, à régler");
    expect(texte(avec(["virement", "wave", "orange-money"]))).toContain(
      "par virement bancaire, Wave ou Orange Money, à régler",
    );
    const html = avec(["wave", "orange-money"]).html.replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    expect(html).toContain("par Wave ou Orange Money, à régler");
  });

  it("dit que l'acompte se règle à Teranga Way, avec les seules coordonnées des instructions", () => {
    expect(texte(avec())).toContain("Il se règle à Teranga Way, uniquement avec les coordonnées de cet e-mail");
    expect(avec().html.replace(/\s+/g, " ")).toContain("Il se règle à Teranga Way");
  });

  it("ne promet toujours rien de payé ni de confirmé", () => {
    const t = avec(["virement", "wave"]).texte;
    expect(t).toContain("Rien n'est payé pour l'instant");
    expect(t).not.toMatch(/paiement (a été |est )?(bien )?reçu\b/i);
    expect(t).not.toMatch(/réservation (est )?confirmée/i);
  });
});

describe("E-mail d'instructions — le partenaire n'encaisse pas", () => {
  it("interdit de verser l'acompte directement au propriétaire", () => {
    const { texte, html } = genererEmailInstructionsAcompte(INSTRUCTIONS);
    expect(texte).toContain("ne le versez jamais directement au propriétaire");
    expect(html.replace(/&nbsp;/g, " ").replace(/\s+/g, " ")).toContain("ne le versez jamais directement au propriétaire");
  });
});
