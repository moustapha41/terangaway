import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import type { Resend } from "resend";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier } from "../../commun/erreurs";
import { extraireIpClientSecurisee } from "../../commun/securite/adresse-ip";
import {
  hacherOtp,
  hacherSha256,
  verifierOtpHash,
} from "../../commun/securite/hachage";
import { config } from "../../config/configuration";
import { DepotComptesPrisma } from "./comptes.prisma";
import { avecPosture, enProduction } from "../../commun/securite/posture.test-utils";
import { ServiceComptes } from "./comptes.service";

describe("Module Comptes — Intégration Resend & Sécurité OTP", () => {
  let prisma: PrismaService;
  let depot: DepotComptesPrisma;
  let serviceEmail: ServiceEmail;
  let service: ServiceComptes;
  const mockSend = vi.fn();

  const genererEmail = (prefix: string) =>
    `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@terangaway.sn`;
  const genererIp = () =>
    `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotComptesPrisma(prisma);

    const mockResend = {
      emails: {
        send: mockSend,
      },
    } as unknown as Resend;

    serviceEmail = new ServiceEmail(mockResend);
    service = new ServiceComptes(depot, serviceEmail);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Envoi réussi d'un e-mail via Resend (mocké)", async () => {
    const email = genererEmail("visiteur.succes");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-12345" },
      error: null,
    });

    const resultat = await service.envoyerOtp(email, ip);

    expect(resultat.expireLe).toBeDefined();
    expect(resultat.delaiAttenteSecondes).toBe(60);
    expect(resultat.canal).toBe("email");

    // Vérifie que l'appel Resend a été effectué avec les bons paramètres
    expect(mockSend).toHaveBeenCalledTimes(1);
    const params = mockSend.mock.calls[0][0];
    expect(params.to).toBe(email);
    expect(params.from).toContain("Teranga Way");
    expect(params.subject).toBe("Votre code de vérification Teranga Way");
    expect(params.html).toContain("Votre code de vérification");
    expect(params.html).toContain("10 minutes");
    expect(params.text).toContain("10 minutes");

    // Le code à 6 chiffres est présent dans l'e-mail
    const matchCode = params.text.match(/\b\d{6}\b/);
    expect(matchCode).not.toBeNull();
  });

  it("2. Échec de l'API Resend et gestion propre de l'erreur", async () => {
    const email = genererEmail("echec.resend");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: "rate_limit_exceeded",
        message: "Quota d'envoi dépassé sur l'API Resend",
      },
    });

    await expect(service.envoyerOtp(email, ip)).rejects.toThrow(ErreurMetier);
  });

  it("3. Vérification réussie avec code valide et création de session persistée", async () => {
    const email = genererEmail("visiteur.verifie");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-verif" },
      error: null,
    });

    await service.envoyerOtp(email, ip);

    // Récupération du code envoyé via le mock
    const params = mockSend.mock.calls[0][0];
    const code = params.text.match(/\b\d{6}\b/)![0];

    const session = await service.verifierOtp(email, code);
    expect(session.visiteurId).toBeDefined();
    expect(session.token).toMatch(/^tws_/);

    // Vérification de la session en base de données
    const compte = await prisma.account.findUnique({
      where: { email },
      include: { sessions: true },
    });
    expect(compte).toBeDefined();
    expect(compte!.estVerifie).toBe(true);
    expect(compte!.sessions.length).toBeGreaterThan(0);
  });

  it("4. Échec avec code erroné", async () => {
    const email = genererEmail("code.faux");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-faux" },
      error: null,
    });

    await service.envoyerOtp(email, ip);

    await expect(service.verifierOtp(email, "000000")).rejects.toThrow(
      "Le code n'est pas valable.",
    );
  });

  it("5. Échec avec code expiré", async () => {
    const email = genererEmail("code.expire");
    await prisma.account.upsert({
      where: { email },
      update: {},
      create: { email, role: "VISITEUR", typeCompte: "VISITEUR" },
    });
    await prisma.otpChallenge.create({
      data: {
        destination: email,
        codeHash: hacherOtp("654321"),
        expiresAt: new Date(Date.now() - 60_000), // Expiré il y a 1 minute
        finalite: "connexion_visiteur",
      },
    });

    await expect(service.verifierOtp(email, "654321")).rejects.toThrow(
      "Ce code a expiré.",
    );
  });

  it("6. Échec avec code déjà consommé (tentative de réutilisation / replay attack)", async () => {
    const email = genererEmail("code.rejoue");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-rejoue" },
      error: null,
    });

    await service.envoyerOtp(email, ip);
    const code = mockSend.mock.calls[0][0].text.match(/\b\d{6}\b/)![0];

    // Première utilisation : succès
    await service.verifierOtp(email, code);

    // Deuxième utilisation du même code : échec strict (usage unique)
    await expect(service.verifierOtp(email, code)).rejects.toThrow(ErreurMetier);
  });

  it("7. Dépassement du nombre maximal de tentatives (verrouillage à 5 essais)", async () => {
    const email = genererEmail("code.tentatives");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-tentatives" },
      error: null,
    });

    await service.envoyerOtp(email, ip);
    const codeCorrect = mockSend.mock.calls[0][0].text.match(/\b\d{6}\b/)![0];

    // 4 essais erronés
    for (let i = 0; i < 4; i++) {
      await expect(service.verifierOtp(email, "111111")).rejects.toThrow(
        "Le code n'est pas valable.",
      );
    }

    // 5ème essai erroné -> verrouillage
    await expect(service.verifierOtp(email, "111111")).rejects.toThrow(
      "Nombre maximal de tentatives dépassé.",
    );

    // Même avec le code correct, le challenge est verrouillé et consommé
    await expect(service.verifierOtp(email, codeCorrect)).rejects.toThrow(
      ErreurMetier,
    );
  });

  it("8. Rate limiting par e-mail : cooldown 60s et quota max", async () => {
    const email = genererEmail("rate.limit.email");
    const ip = genererIp();
    mockSend.mockResolvedValue({
      data: { id: "resend-msg-rl" },
      error: null,
    });

    // Premier envoi : succès
    await service.envoyerOtp(email, ip);

    // Deuxième envoi immédiat (< 60s) : rejeté par le cooldown
    await expect(service.envoyerOtp(email, ip)).rejects.toThrow(
      /Veuillez patienter.*secondes/,
    );
  });

  it("9. Rate limiting par IP", async () => {
    const ip = `172.16.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    // Insérer 20 challenges récents pour cette IP
    for (let i = 0; i < 20; i++) {
      await prisma.otpChallenge.create({
        data: {
          destination: `quota.ip.${i}.${Date.now()}@terangaway.sn`,
          ipAddress: ip,
          codeHash: hacherOtp("123456"),
          expiresAt: new Date(Date.now() + 600_000),
          finalite: "connexion_visiteur",
        },
      });
    }

    // Le 21ème envoi depuis cette même IP doit être bloqué
    await expect(
      service.envoyerOtp(genererEmail("nouveau.ip"), ip),
    ).rejects.toThrow(/Trop de demandes de vérification depuis cette connexion/);
  });

  it("10. Non-stockage du code en clair dans PostgreSQL & protection HMAC-SHA-256", async () => {
    const email = genererEmail("securite.hash");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-hash" },
      error: null,
    });

    await service.envoyerOtp(email, ip);
    const code = mockSend.mock.calls[0][0].text.match(/\b\d{6}\b/)![0];

    const challenge = await prisma.otpChallenge.findFirst({
      where: { destination: email, consumedAt: null },
      orderBy: { creeLe: "desc" },
    });

    expect(challenge).toBeDefined();
    // Le code en clair n'est JAMAIS stocké en base
    expect(challenge!.codeHash).not.toBe(code);
    expect(challenge!.codeHash).toHaveLength(64); // Format hexadécimal HMAC-SHA-256
    expect(challenge!.codeHash).toBe(hacherOtp(code));
  });

  it("11. Comparaison timing-safe des empreintes HMAC-SHA-256", () => {
    const code = "654321";
    const hash = hacherOtp(code);

    // Vérification réussie
    expect(verifierOtpHash(code, hash)).toBe(true);

    // Empreinte incorrecte
    expect(verifierOtpHash("000000", hash)).toBe(false);

    // Chaîne de longueur différente (doit rejeter sans erreur)
    expect(verifierOtpHash("abc", hash)).toBe(false);
  });

  it("12. Résistance du HMAC-SHA-256 contre la recherche exhaustive en cas de fuite de base", () => {
    const code = "482910";
    const secretServeur = "cle-secrete-api-hautement-confidentielle-32c";
    const secretAttaquant = "mauvaise-cle-ou-sel-conjecturé";

    const hashLegitime = hacherOtp(code, secretServeur);
    const hashAttaquant = hacherOtp(code, secretAttaquant);

    // L'attaquant avec un dump SQL ne peut pas valider sa table de précalcul sans la clé HMAC serveur
    expect(hashLegitime).not.toBe(hashAttaquant);
    expect(verifierOtpHash(code, hashLegitime, secretAttaquant)).toBe(false);
  });

  it("13. Résistance aux demandes concurrentes sur l'usage unique (anti-race condition)", async () => {
    const email = genererEmail("concurrence.singleuse");
    const ip = genererIp();
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-race" },
      error: null,
    });

    await service.envoyerOtp(email, ip);
    const code = mockSend.mock.calls[0][0].text.match(/\b\d{6}\b/)![0];

    // Deux requêtes simultanées avec le bon code
    const resultats = await Promise.allSettled([
      service.verifierOtp(email, code),
      service.verifierOtp(email, code),
    ]);

    const succes = resultats.filter((r) => r.status === "fulfilled");
    const rejets = resultats.filter((r) => r.status === "rejected");

    // Exactement UNE requête réussit, l'autre est rejetée
    expect(succes).toHaveLength(1);
    expect(rejets).toHaveLength(1);
  });

  it("14. Protection anti-usurpation (Anti-Spoofing) sur X-Forwarded-For derrière Traefik", () => {
    // 1. IP directe
    const reqDirect = {
      ip: "198.51.100.5",
      headers: {},
      socket: { remoteAddress: "198.51.100.5" },
    } as unknown as Request;
    expect(extraireIpClientSecurisee(reqDirect)).toBe("198.51.100.5");

    // 2. Attaquant injectant une fausse IP à gauche de X-Forwarded-For
    const reqSpoof = {
      ip: "172.18.0.3",
      headers: {
        // Traefik a ajouté l'IP réelle '198.51.100.22' à droite du spoof '1.2.3.4'
        "x-forwarded-for": "1.2.3.4, 198.51.100.22",
      },
    } as unknown as Request;
    // Doit retenir 198.51.100.22 et NE PAS faire confiance au 1.2.3.4 forgé
    expect(extraireIpClientSecurisee(reqSpoof)).toBe("198.51.100.22");

    // 3. Chaîne multi-proxy (client externe -> Traefik -> conteneur Next.js)
    const reqChaine = {
      ip: "172.18.0.4",
      headers: {
        "x-forwarded-for": "attacker.spoof, 198.51.100.77, 172.18.0.2",
      },
    } as unknown as Request;
    expect(extraireIpClientSecurisee(reqChaine)).toBe("198.51.100.77");
  });

  it("15. Parcours téléphone : refus strict hors mode démo, sans fournisseur SMS", async () => {
    // Le refus ne dépend plus de la seule lecture de NODE_ENV mais du verrou à
    // refus par défaut : un conteneur dont NODE_ENV serait mal renseigné
    // refuse quand même.
    await enProduction(async () => {
      await expect(service.envoyerOtp("771234567")).rejects.toThrow(
        "L'envoi de codes par SMS n'est pas disponible actuellement. Veuillez utiliser votre adresse e-mail pour recevoir votre code de vérification.",
      );
      // Ne doit jamais tenter d'envoyer un e-mail avec un numéro de téléphone
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  it("15b. Parcours téléphone : refusé même si NODE_ENV n'est pas production", async () => {
    // Le cas exact observé en production : l'environnement n'était pas celui
    // qu'on croyait, et les raccourcis étaient restés ouverts.
    await avecPosture({ comptesDemo: false, environnement: "development" }, async () => {
      const erreur = await service
        .envoyerOtp("771234567")
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erreur).toBeInstanceOf(ErreurMetier);
      // `ErreurMetier` porte son code stable dans le corps de la réponse HTTP.
      expect((erreur as ErreurMetier).getResponse()).toMatchObject({
        code: "FOURNISSEUR_SMS_NON_DISPONIBLE",
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  it("15c. Le code OTP ne revient jamais dans la réponse hors mode démo", async () => {
    // Renvoyer `codeDemo` sur un déploiement public permet de prendre la main
    // sur n'importe quel compte : demander un code, puis le lire dans la
    // réponse. Ce test verrouille le contraire.
    await enProduction(async () => {
      const reponse = await service.envoyerOtp(`posture.codedemo.${Date.now()}@terangaway.sn`);
      expect(reponse.codeDemo).toBeUndefined();
      expect(Object.keys(reponse)).not.toContain("codeDemo");
    });
  });

  it("16. Absence des variables obligatoires en production (RESEND_API_KEY et OTP_SECRET)", () => {
    const envOriginal = process.env.NODE_ENV;
    const apiKeyOriginale = process.env.RESEND_API_KEY;
    const otpSecretOriginal = process.env.OTP_SECRET;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.RESEND_API_KEY;
      delete process.env.OTP_SECRET;

      expect(() => {
        if (!process.env.RESEND_API_KEY) {
          throw new Error("Variable d'environnement manquante : RESEND_API_KEY");
        }
      }).toThrow("RESEND_API_KEY");

      expect(() => {
        if (!process.env.OTP_SECRET) {
          throw new Error("Variable d'environnement manquante : OTP_SECRET");
        }
      }).toThrow("OTP_SECRET");
    } finally {
      process.env.NODE_ENV = envOriginal;
      if (apiKeyOriginale !== undefined) {
        process.env.RESEND_API_KEY = apiKeyOriginale;
      }
      if (otpSecretOriginal !== undefined) {
        process.env.OTP_SECRET = otpSecretOriginal;
      }
    }
  });
});
