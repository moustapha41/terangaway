import { describe, expect, it } from "vitest";

import { hacherOtp, verifierOtpHash } from "../commun/securite/hachage";
import { ControleurSante, postureAcompte } from "../modules/sante/sante.controller";
import { chargerConfiguration } from "./configuration";

/**
 * Des valeurs bancaires de test, et qui ne ressemblent à aucun compte réel.
 *
 * Aucune coordonnée vraisemblable n'est écrite dans ce dépôt — ni ici, ni
 * ailleurs. Ces sentinelles ont la *forme* attendue (l'IBAN tient dans les 15 à
 * 34 caractères alphanumériques de la norme) sans jamais pouvoir être prises
 * pour un compte à créditer.
 */
const BANQUE_DE_TEST = {
  ACOMPTE_BANQUE_TITULAIRE: "TITULAIRE-DE-TEST",
  ACOMPTE_BANQUE_NOM: "BANQUE-DE-TEST",
  ACOMPTE_BANQUE_IBAN: "IBANDETESTNEPASUTILISER",
  ACOMPTE_BANQUE_BIC: "BICDETEST",
} as const;

describe("Configuration API — Validation au démarrage & Rotation OTP", () => {
  it("charge la configuration par défaut en mode développement sans lever d'erreur", () => {
    const config = chargerConfiguration({
      NODE_ENV: "development",
      PORT: "3001",
    });

    expect(config.environnement).toBe("development");
    expect(config.port).toBe(3001);
    expect(config.resendApiKey).toBe("");
    expect(config.emailFrom).toBe("Teranga Way <auth@teranga-way.com>");
    expect(config.appUrl).toBe("http://localhost:3000");
    expect(config.otpSecret).toBeDefined();
    expect(config.otpSecretsPourVerification.length).toBeGreaterThan(0);
  });

  it("charge la configuration complète en production lorsque toutes les variables obligatoires sont présentes", () => {
    const config = chargerConfiguration({
      NODE_ENV: "production",
      PORT: "3101",
      RESEND_API_KEY: "re_test_valid_key_12345",
      OTP_SECRET: "secret_robuste_production_32_caracteres_min",
      EMAIL_FROM: "Teranga Way <auth@teranga-way.com>",
      APP_URL: "https://teranga-way.com",
    });

    expect(config.environnement).toBe("production");
    expect(config.port).toBe(3101);
    expect(config.resendApiKey).toBe("re_test_valid_key_12345");
    expect(config.otpSecret).toBe("secret_robuste_production_32_caracteres_min");
    expect(config.emailFrom).toBe("Teranga Way <auth@teranga-way.com>");
    expect(config.appUrl).toBe("https://teranga-way.com");
  });

  it("lève une exception explicite en production si RESEND_API_KEY est absente", () => {
    expect(() =>
      chargerConfiguration({
        NODE_ENV: "production",
        OTP_SECRET: "secret_robuste_production_32_caracteres_min",
      }),
    ).toThrow("Variable d'environnement manquante : RESEND_API_KEY");
  });

  it("lève une exception explicite en production si RESEND_API_KEY est une chaîne vide ou du blanc", () => {
    expect(() =>
      chargerConfiguration({
        NODE_ENV: "production",
        RESEND_API_KEY: "   ",
        OTP_SECRET: "secret_robuste_production_32_caracteres_min",
      }),
    ).toThrow("Variable d'environnement manquante : RESEND_API_KEY");
  });

  it("lève une exception explicite en production si OTP_SECRET est absent ou vide", () => {
    expect(() =>
      chargerConfiguration({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test_valid_key_12345",
        OTP_SECRET: "",
      }),
    ).toThrow("Variable d'environnement manquante : OTP_SECRET");
  });

  it("gère la rotation de clé OTP sans compromettre les OTP émis avec l'ancienne clé (via liste séparée par virgules)", () => {
    const cleAncienne = "cle_secrete_ancienne_pendant_emission_123";
    const cleNouvelle = "cle_secrete_nouvelle_apres_rotation_456";

    // 1. Code émis avant rotation avec l'ancienne clé
    const code = "654321";
    const hashAncien = hacherOtp(code, cleAncienne);

    // 2. Déploiement avec la nouvelle clé en actif, et l'ancienne clé conservée pour vérification
    const configRotation = chargerConfiguration({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_valid_key_12345",
      OTP_SECRET: `${cleNouvelle},${cleAncienne}`,
    });

    expect(configRotation.otpSecret).toBe(cleNouvelle);
    expect(configRotation.otpSecretsPourVerification).toEqual([cleNouvelle, cleAncienne]);

    // 3. Vérification du code émis avec l'ancienne clé : doit être accepté
    const valide = verifierOtpHash(
      code,
      hashAncien,
      configRotation.otpSecret,
      configRotation.otpSecretsPourVerification,
    );
    expect(valide).toBe(true);

    // 4. Un faux code doit toujours être rejeté
    expect(
      verifierOtpHash(
        "000000",
        hashAncien,
        configRotation.otpSecret,
        configRotation.otpSecretsPourVerification,
      ),
    ).toBe(false);
  });

  it("gère la rotation de clé OTP via OTP_PREVIOUS_SECRET", () => {
    const cleAncienne = "cle_precedente_pendant_emission_789";
    const cleNouvelle = "cle_active_apres_rotation_012";

    const code = "987654";
    const hashAncien = hacherOtp(code, cleAncienne);

    const configRotation = chargerConfiguration({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_valid_key_12345",
      OTP_SECRET: cleNouvelle,
      OTP_PREVIOUS_SECRET: cleAncienne,
    });

    expect(configRotation.otpSecret).toBe(cleNouvelle);
    expect(configRotation.otpSecretsPourVerification).toEqual([cleNouvelle, cleAncienne]);

    const valide = verifierOtpHash(
      code,
      hashAncien,
      configRotation.otpSecret,
      configRotation.otpSecretsPourVerification,
    );
    expect(valide).toBe(true);
  });

  it("garantit que le contrôleur de santé /sante ne divulgue aucune information interne", () => {
    const controleur = new ControleurSante();
    const etat = controleur.etat();

    expect(etat).toEqual({
      etat: "ok",
      depuisSecondes: expect.any(Number),
    });
    expect(etat).not.toHaveProperty("config");
    expect(etat).not.toHaveProperty("resend");
    expect(etat).not.toHaveProperty("otpSecret");
  });
});

/**
 * L'acompte par virement : fermé par défaut, et il faut trois clés pour
 * l'ouvrir.
 *
 * L'enjeu n'est pas le confort de configuration, c'est l'argent : tant que la
 * revue juridique n'a pas eu lieu, aucun montant ne doit pouvoir être réclamé
 * à qui que ce soit. Et le jour où quelqu'un réclame l'acompte sans fournir de
 * quoi le recevoir, l'API doit le dire fort plutôt que de se taire.
 */
describe("Configuration API — Acompte par virement bancaire", () => {
  const base = { NODE_ENV: "development", PORT: "3001" } as const;

  it("est fermé quand rien n'est configuré, et n'empêche pas l'API de démarrer", () => {
    const config = chargerConfiguration({ ...base });

    expect(config.acompte.actif).toBe(false);
    expect(config.acompte.pourcentage).toBeUndefined();
    expect(config.acompte.etatCoordonnees).toBe("absent");
    expect(config.acompte.beneficiaire).toBeUndefined();
  });

  it("ne porte aucun délai : il dépend du genre, pas de l'environnement", () => {
    // Le défaut corrigé : un `ACOMPTE_DELAI_HEURES` unique imposait les douze
    // heures du logement à la location, qui n'en a que trois. La variable est
    // retirée, et ce test interdit qu'elle revienne — même posée, elle ne doit
    // plus avoir d'effet.
    const config = chargerConfiguration({ ...base, ACOMPTE_DELAI_HEURES: "12" });

    expect(config.acompte).not.toHaveProperty("delaiHeures");
    expect(Object.keys(config.acompte).sort()).toEqual([
      "actif",
      "beneficiaire",
      "etatCoordonnees",
      "pourcentage",
    ]);
  });

  it("reste fermé avec le seul taux : sans compte bancaire, il n'y a rien à créditer", () => {
    const config = chargerConfiguration({ ...base, ACOMPTE_POURCENTAGE: "30" });

    expect(config.acompte.pourcentage).toBe(30);
    expect(config.acompte.etatCoordonnees).toBe("absent");
    expect(config.acompte.actif).toBe(false);
  });

  it("reste fermé avec le taux et le compte, mais sans le verrou explicite", () => {
    // C'est la porte que tient la revue juridique : tout est prêt, rien ne part.
    const config = chargerConfiguration({
      ...base,
      ACOMPTE_POURCENTAGE: "30",
      ...BANQUE_DE_TEST,
    });

    expect(config.acompte.etatCoordonnees).toBe("defini");
    expect(config.acompte.actif).toBe(false);
  });

  it("ne s'ouvre qu'avec les trois clés réunies", () => {
    const config = chargerConfiguration({
      ...base,
      ACOMPTE_ACTIF: "true",
      ACOMPTE_POURCENTAGE: "30",
      ...BANQUE_DE_TEST,
    });

    expect(config.acompte.actif).toBe(true);
    expect(config.acompte.pourcentage).toBe(30);
    expect(config.acompte.beneficiaire).toEqual({
      titulaire: "TITULAIRE-DE-TEST",
      banque: "BANQUE-DE-TEST",
      iban: "IBANDETESTNEPASUTILISER",
      bic: "BICDETEST",
    });
  });

  it("n'expose aucune coordonnée tant qu'elles sont incomplètes", () => {
    // Un IBAN sans BIC, c'est un virement international qui n'arrive pas — et
    // un visiteur qui croit avoir payé.
    const config = chargerConfiguration({
      ...base,
      ACOMPTE_POURCENTAGE: "30",
      ACOMPTE_BANQUE_TITULAIRE: BANQUE_DE_TEST.ACOMPTE_BANQUE_TITULAIRE,
      ACOMPTE_BANQUE_IBAN: BANQUE_DE_TEST.ACOMPTE_BANQUE_IBAN,
    });

    expect(config.acompte.etatCoordonnees).toBe("incomplet");
    expect(config.acompte.beneficiaire).toBeUndefined();
    expect(config.acompte.actif).toBe(false);
  });

  it("normalise l'IBAN : sans espaces et en majuscules", () => {
    // Le visiteur le recopiera à la main dans un formulaire de virement :
    // « ibandetest nepas utiliser » et la forme canonique doivent désigner le
    // même compte.
    const config = chargerConfiguration({
      ...base,
      ...BANQUE_DE_TEST,
      ACOMPTE_BANQUE_IBAN: "ibandetest nepas utiliser",
      ACOMPTE_BANQUE_BIC: "bic de test",
    });

    expect(config.acompte.beneficiaire?.iban).toBe("IBANDETESTNEPASUTILISER");
    expect(config.acompte.beneficiaire?.bic).toBe("BICDETEST");
  });

  it("lève si l'acompte est réclamé sans rien pour le réclamer", () => {
    expect(() => chargerConfiguration({ ...base, ACOMPTE_ACTIF: "true" })).toThrow(
      /ACOMPTE_ACTIF=true mais l'acompte ne peut pas être réclamé/,
    );
  });

  it("lève en nommant le taux fautif", () => {
    expect(() =>
      chargerConfiguration({
        ...base,
        ACOMPTE_ACTIF: "true",
        ACOMPTE_POURCENTAGE: "150",
        ...BANQUE_DE_TEST,
      }),
    ).toThrow(/ACOMPTE_POURCENTAGE vaut « 150 »/);
  });

  it("lève en nommant les coordonnées manquantes", () => {
    expect(() =>
      chargerConfiguration({
        ...base,
        ACOMPTE_ACTIF: "true",
        ACOMPTE_POURCENTAGE: "30",
        ACOMPTE_BANQUE_TITULAIRE: BANQUE_DE_TEST.ACOMPTE_BANQUE_TITULAIRE,
      }),
    ).toThrow(/coordonnées bancaires sont incomplètes/);
  });

  it("lève sur un IBAN qui n'a pas la forme d'un IBAN", () => {
    expect(() =>
      chargerConfiguration({
        ...base,
        ACOMPTE_ACTIF: "true",
        ACOMPTE_POURCENTAGE: "30",
        ...BANQUE_DE_TEST,
        ACOMPTE_BANQUE_IBAN: "trop-court",
      }),
    ).toThrow(/ACOMPTE_BANQUE_IBAN n'a pas la forme d'un IBAN/);
  });

  it("ne lève jamais quand l'acompte n'est pas réclamé, même mal configuré", () => {
    // Une coquille dans une variable d'une fonctionnalité fermée ne doit pas
    // emporter l'API entière : tout le reste du produit marche sans acompte.
    expect(() =>
      chargerConfiguration({
        ...base,
        ACOMPTE_POURCENTAGE: "pas un nombre",
        ACOMPTE_BANQUE_IBAN: "x",
      }),
    ).not.toThrow();
  });
});

describe("Supervision — /sante/posture ne divulgue jamais le compte bancaire", () => {
  it("ne rend que l'état des coordonnées, jamais leur contenu", () => {
    const projection = postureAcompte({
      actif: true,
      pourcentage: 30,
      etatCoordonnees: "defini",
      beneficiaire: {
        titulaire: "TITULAIRE-DE-TEST",
        banque: "BANQUE-DE-TEST",
        iban: "IBANDETESTNEPASUTILISER",
        bic: "BICDETEST",
      },
    });

    expect(projection).toEqual({
      actif: true,
      pourcentage: 30,
      delaisHeures: { logement: 12, location: 3, trajet: null, taxi: null, service: null },
      coordonneesBancaires: "defini",
    });

    // La garantie, écrite comme telle : aucune des quatre valeurs ne peut
    // ressortir, quelle que soit la façon dont on sérialise la réponse.
    const serialise = JSON.stringify(projection);
    expect(serialise).not.toContain("IBANDETESTNEPASUTILISER");
    expect(serialise).not.toContain("BICDETEST");
    expect(serialise).not.toContain("TITULAIRE-DE-TEST");
    expect(serialise).not.toContain("BANQUE-DE-TEST");
    expect(projection).not.toHaveProperty("beneficiaire");
  });

  it("dit « absent » et un taux nul quand rien n'est configuré", () => {
    expect(
      postureAcompte({
        actif: false,
        pourcentage: undefined,
        etatCoordonnees: "absent",
        beneficiaire: undefined,
      }),
    ).toEqual({
      actif: false,
      pourcentage: null,
      delaisHeures: { logement: 12, location: 3, trajet: null, taxi: null, service: null },
      coordonneesBancaires: "absent",
    });
  });

  it("annonce les délais par genre, même acompte fermé", () => {
    // Les délais sont une règle métier, pas une valeur de configuration : ils
    // se lisent en exploitation quel que soit l'état du verrou.
    const projection = postureAcompte({
      actif: false,
      pourcentage: undefined,
      etatCoordonnees: "absent",
      beneficiaire: undefined,
    });

    expect(projection.delaisHeures.logement).toBe(12);
    expect(projection.delaisHeures.location).toBe(3);
    expect(projection.delaisHeures.trajet).toBeNull();
    expect(projection.delaisHeures.taxi).toBeNull();
  });

  it("expose le bloc acompte dans la posture réelle, sans coordonnées", () => {
    const posture = new ControleurSante().posture();

    expect(posture.acompte).toBeDefined();
    // L'environnement de test ne configure aucun acompte : fermé, donc.
    expect(posture.acompte.actif).toBe(false);
    expect(posture.acompte.coordonneesBancaires).toBe("absent");
    expect(JSON.stringify(posture)).not.toContain("iban");
  });
});
