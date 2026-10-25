import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { genererEmailInstructionsAcompte, genererEmailReceptionAcompte } from "../../commun/email/modeles/acompte.modele";
import { chargerConfiguration, type ConfigAcompte } from "../../config/configuration";
import { DeciderPaiementTardifDto, SaisirReceptionDto } from "./dto/acompte-admin.dto";
import { coordonneesPaiement } from "./paiement";

/** Sentinelles : aucune coordonnée vraisemblable dans ce dépôt. */
const BANQUE = {
  ACOMPTE_BANQUE_TITULAIRE: "TITULAIRE-DE-TEST",
  ACOMPTE_BANQUE_NOM: "BANQUE-DE-TEST",
  ACOMPTE_BANQUE_IBAN: "IBANDETESTNEPASUTILISER",
  ACOMPTE_BANQUE_BIC: "BICDETEST",
} as const;
const WAVE = { ACOMPTE_WAVE_NUMERO: "+221 00 000 00 00", ACOMPTE_WAVE_TITULAIRE: "TITULAIRE-WAVE-DE-TEST" } as const;
const ORANGE = { ACOMPTE_ORANGE_MONEY_NUMERO: "000000000", ACOMPTE_ORANGE_MONEY_TITULAIRE: "TITULAIRE-OM-DE-TEST" } as const;
const base = { NODE_ENV: "development", PORT: "3001", ACOMPTE_ACTIF: "true", ACOMPTE_POURCENTAGE: "30" } as const;

describe("Configuration — moyens de paiement et Mobile Money", () => {
  it("reste le virement seul quand ACOMPTE_MOYENS n'est pas posée (comportement inchangé)", () => {
    const c = chargerConfiguration({ ...base, ...BANQUE });
    expect(c.acompte).toMatchObject({ actif: true, moyens: ["virement"], mobileMoney: [] });
  });

  it("ouvre l'acompte avec Wave et Orange Money, numéros normalisés", () => {
    const c = chargerConfiguration({ ...base, ...BANQUE, ...WAVE, ...ORANGE, ACOMPTE_MOYENS: "virement, Wave ,orange-money,wave" });
    expect(c.acompte.actif).toBe(true);
    expect(c.acompte.moyens).toEqual(["virement", "wave", "orange-money"]);
    expect(c.acompte.mobileMoney).toEqual([
      { operateur: "wave", numero: "+221000000000", titulaire: "TITULAIRE-WAVE-DE-TEST" },
      { operateur: "orange-money", numero: "000000000", titulaire: "TITULAIRE-OM-DE-TEST" },
    ]);
  });

  it("permet un acompte sans virement : Mobile Money seul, sans coordonnées bancaires", () => {
    const c = chargerConfiguration({ ...base, ...WAVE, ACOMPTE_MOYENS: "wave" });
    expect(c.acompte.actif).toBe(true);
    expect(c.acompte.beneficiaire).toBeUndefined();
  });

  it.each([
    ["moyen inconnu", { ...BANQUE, ACOMPTE_MOYENS: "virement,carte" }, /carte/],
    ["liste de moyens vide de sens", { ...BANQUE, ACOMPTE_MOYENS: " , " }, /aucun moyen|ACOMPTE_MOYENS/],
    ["Wave accepté sans numéro", { ...BANQUE, ACOMPTE_MOYENS: "virement,wave" }, /wave est accepté/],
    ["numéro sans titulaire", { ...BANQUE, ACOMPTE_MOYENS: "virement,wave", ACOMPTE_WAVE_NUMERO: "+221000000000" }, /requis ensemble/],
    ["titulaire sans numéro", { ...BANQUE, ACOMPTE_MOYENS: "virement,wave", ACOMPTE_WAVE_TITULAIRE: "X" }, /requis ensemble|numéro/],
    ["numéro mal formé", { ...BANQUE, ACOMPTE_MOYENS: "virement,wave", ACOMPTE_WAVE_NUMERO: "12ab", ACOMPTE_WAVE_TITULAIRE: "X" }, /forme d'un numéro/],
    ["numéro trop court", { ACOMPTE_MOYENS: "wave", ACOMPTE_WAVE_NUMERO: "1234567", ACOMPTE_WAVE_TITULAIRE: "X" }, /forme d'un numéro/],
    ["virement accepté sans compte bancaire", { ACOMPTE_MOYENS: "virement" }, /coordonnée bancaire/],
    ["instructions trop longues", { ...BANQUE, ACOMPTE_INSTRUCTIONS: "x".repeat(501) }, /ACOMPTE_INSTRUCTIONS/],
  ])("lève si l'acompte est réclamé avec : %s", (_nom, env, motif) => {
    expect(() => chargerConfiguration({ ...base, ...env })).toThrow(motif);
  });

  it("ne lève jamais et reste fermé quand l'acompte n'est pas réclamé, même mal configuré", () => {
    const c = chargerConfiguration({ NODE_ENV: "development", PORT: "3001", ACOMPTE_MOYENS: "carte", ACOMPTE_WAVE_NUMERO: "zz" });
    expect(c.acompte.actif).toBe(false);
  });

  it("ne rend jamais un compte Mobile Money incomplet", () => {
    const c = chargerConfiguration({ NODE_ENV: "development", PORT: "3001", ACOMPTE_WAVE_NUMERO: "+221000000000" });
    expect(c.acompte.mobileMoney).toEqual([]);
  });
});

describe("coordonneesPaiement — ce qui peut réellement être proposé", () => {
  const complet: ConfigAcompte = {
    actif: true,
    pourcentage: 30,
    etatCoordonnees: "defini",
    beneficiaire: { titulaire: "T", banque: "B", iban: "IBANDETESTNEPASUTILISER", bic: "BICDETEST" },
    moyens: ["virement", "wave"],
    mobileMoney: [
      { operateur: "wave", numero: "+221000000000", titulaire: "TW" },
      { operateur: "orange-money", numero: "000000000", titulaire: "TO" },
    ],
  };

  it("ne propose que les moyens acceptés", () => {
    const c = coordonneesPaiement(complet)!;
    expect(c.moyens).toEqual(["virement", "wave"]);
    expect(c.mobileMoney.map((m) => m.operateur)).toEqual(["wave"]);
  });

  it("sans `moyens`, retombe sur le virement seul", () => {
    const { moyens: _m, ...ancienne } = complet;
    expect(coordonneesPaiement(ancienne)!.moyens).toEqual(["virement"]);
  });

  it("ne propose rien quand rien d'accepté n'est configuré", () => {
    expect(coordonneesPaiement({ ...complet, beneficiaire: undefined, moyens: ["virement"] })).toBeUndefined();
    expect(coordonneesPaiement({ ...complet, moyens: ["orange-money"], mobileMoney: [] })).toBeUndefined();
  });
});

describe("E-mails — Mobile Money et réception", () => {
  const instr = {
    reference: "TW-123456",
    titre: "Villa <b>à</b> Saly",
    total: "620 000 FCFA",
    acompte: "186 000 FCFA",
    pourcentage: 30,
    echeance: "2 novembre à 08:00",
  };

  it("montre uniquement les moyens fournis, sous réserve de paiement", () => {
    const wave = genererEmailInstructionsAcompte({
      ...instr,
      mobileMoney: [{ operateur: "wave", numero: "+221000000000", titulaire: "TITULAIRE-WAVE-DE-TEST" }],
      instructions: "Indiquez la référence en message.",
    });
    expect(wave.texte).toContain("sous réserve");
    expect(wave.texte).toContain("— Wave —");
    expect(wave.texte).toContain("+221000000000");
    expect(wave.texte).toContain("Indiquez la référence en message.");
    expect(wave.texte).not.toContain("IBAN");
    expect(wave.html).not.toContain("Le virement");
    expect(wave.html).toContain("&lt;b&gt;");
    expect(wave.texte).not.toMatch(/paiement (a été |est )?(bien )?reçu\b/i);
    expect(wave.texte).not.toMatch(/\bconfirmé\b/i);
  });

  const reception = {
    reference: "TW-123456",
    titre: "Villa à Saly",
    montantRecu: "186 000 FCFA",
    cumulRecu: "186 000 FCFA",
    acompteAttendu: "186 000 FCFA",
    soldeSejour: "434 000 FCFA",
    dateValidation: "2 novembre à 08:00",
    statutReservation: "acceptée par le propriétaire, pas encore confirmée",
    reservationConfirmee: false,
  };

  it("dit le statut réel de la réservation et ne la déclare pas confirmée à tort", () => {
    const m = genererEmailReceptionAcompte(reception);
    expect(m.texte).toContain("Votre acompte est reçu et vérifié");
    expect(m.texte).toContain("Statut de la réservation : acceptée par le propriétaire, pas encore confirmée");
    expect(m.texte).toContain("ne vaut pas, à elle seule, confirmation");
    expect(m.texte).not.toMatch(/réservation (est )?confirmée\b/i);
    expect(m.texte).not.toContain("Reste à régler");
  });

  it("signale un versement partiel et le reste dû, sans dire que l'acompte est reçu", () => {
    const m = genererEmailReceptionAcompte({ ...reception, montantRecu: "100 000 FCFA", cumulRecu: "100 000 FCFA", resteAcompte: "86 000 FCFA" });
    expect(m.texte).toContain("Un versement a été reçu et vérifié");
    expect(m.texte).not.toContain("Votre acompte est reçu");
    expect(m.texte).toContain("Reste à régler sur l'acompte : 86 000 FCFA");
    expect(m.sujet).toContain("Versement reçu");
  });

  it("signale un surplus sans promettre de remboursement", () => {
    const m = genererEmailReceptionAcompte({ ...reception, surplus: "14 000 FCFA" });
    expect(m.texte).toContain("Montant supérieur à l'acompte : 14 000 FCFA");
    expect(m.texte).toContain("aucun remboursement n'a été effectué automatiquement");
  });

  it("dit au visiteur qu'il lui reste à confirmer, seulement quand l'acompte est complet et la demande acceptée", () => {
    const attendue = genererEmailReceptionAcompte({ ...reception, confirmationAttendue: true });
    expect(attendue.texte).toContain("vous pouvez maintenant confirmer votre réservation depuis votre");
    expect(attendue.texte).toContain("Tant que vous ne l'avez pas fait, elle n'est pas confirmée.");
    // Un versement partiel n'ouvre pas la confirmation.
    const partiel = genererEmailReceptionAcompte({ ...reception, confirmationAttendue: true, resteAcompte: "86 000 FCFA" });
    expect(partiel.texte).not.toContain("vous pouvez maintenant confirmer");
    // Déjà confirmée, ou non attendue : rien à ajouter.
    const deja = genererEmailReceptionAcompte({
      ...reception, statutReservation: "confirmée", reservationConfirmee: true, confirmationAttendue: true,
    });
    expect(deja.texte).not.toContain("vous pouvez maintenant confirmer");
    expect(genererEmailReceptionAcompte(reception).texte).not.toContain("vous pouvez maintenant confirmer");
  });

  it("n'ajoute la mise en garde que si la réservation n'est pas déjà confirmée", () => {
    const m = genererEmailReceptionAcompte({ ...reception, statutReservation: "confirmée", reservationConfirmee: true });
    expect(m.texte).not.toContain("ne vaut pas, à elle seule");
  });
});

describe("Validation du corps des routes d'acompte", () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const valider = (valeur: object, type: new () => object) =>
    pipe.transform(valeur, { type: "body", metatype: type }).then(() => "ok", () => "refus");

  it.each([
    ["valide", { montant: 186000, montantRecuAvant: 0 }, "ok"],
    ["montant nul", { montant: 0, montantRecuAvant: 0 }, "refus"],
    ["montant négatif", { montant: -5, montantRecuAvant: 0 }, "refus"],
    ["montant décimal", { montant: 10.5, montantRecuAvant: 0 }, "refus"],
    ["montant en texte", { montant: "186000", montantRecuAvant: 0 }, "refus"],
    ["montant démesuré", { montant: 2_000_000_000, montantRecuAvant: 0 }, "refus"],
    ["cumul absent", { montant: 5 }, "refus"],
    ["champ inattendu (acteur forgé)", { montant: 5, montantRecuAvant: 0, acteurId: "x" }, "refus"],
    ["champ inattendu (montant attendu forgé)", { montant: 5, montantRecuAvant: 0, montantAttendu: 1 }, "refus"],
    ["commentaire trop long", { montant: 5, montantRecuAvant: 0, commentaire: "x".repeat(501) }, "refus"],
    ["écart non booléen", { montant: 5, montantRecuAvant: 0, ecartConfirme: "oui" }, "refus"],
  ])("réception : %s", async (_nom, corps, attendu) => {
    expect(await valider(corps, SaisirReceptionDto)).toBe(attendu);
  });

  it.each([
    [{ issue: "accepter", commentaire: "vérifié" }, "ok"],
    [{ issue: "tout", commentaire: "x" }, "refus"],
    [{ issue: "accepter" }, "refus"],
  ])("paiement tardif : %j", async (corps, attendu) => {
    expect(await valider(corps, DeciderPaiementTardifDto)).toBe(attendu);
  });
});
