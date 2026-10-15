import { describe, expect, it } from "vitest";

import { hacherOtp, verifierOtpHash } from "../commun/securite/hachage";
import { ControleurSante } from "../modules/sante/sante.controller";
import { chargerConfiguration } from "./configuration";

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
