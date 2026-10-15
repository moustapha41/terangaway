import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotComptesPrisma } from "./comptes.prisma";
import { ServiceComptes } from "./comptes.service";

describe("Persistance PostgreSQL — Module Comptes & Authentification", () => {
  let service: ServiceComptes;
  let prisma: PrismaService;
  let depot: DepotComptesPrisma;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    depot = new DepotComptesPrisma(prisma);
    service = new ServiceComptes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("génère un OTP avec empreinte cryptographique en base (jamais en clair)", async () => {
    const telephone = "771112233";
    const { codeDemo } = await service.envoyerOtp(telephone);

    // Vérification directe en base PostgreSQL
    const challenge = await prisma.otpChallenge.findFirst({
      where: { destination: telephone, consumedAt: null },
      orderBy: { creeLe: "desc" },
    });

    expect(challenge).toBeDefined();
    // Le code en clair n'est JAMAIS stocké
    expect(challenge!.codeHash).not.toBe(codeDemo);
    expect(challenge!.codeHash).toHaveLength(64); // Empreinte SHA-256
    expect(challenge!.attempts).toBe(0);
    expect(challenge!.maxAttempts).toBe(5);
  });

  it("vérifie l'OTP avec succès, consomme le challenge (single-use) et crée une session persistée", async () => {
    const telephone = "772223344";
    const { codeDemo } = await service.envoyerOtp(telephone);

    const resultat = await service.verifierOtp(telephone, codeDemo);
    expect(resultat.visiteurId).toBeDefined();
    expect(resultat.token).toBeDefined();
    expect(resultat.token).toMatch(/^tws_/);

    // Le challenge a été consommé (usage unique)
    const challengeConsomme = await prisma.otpChallenge.findFirst({
      where: { destination: telephone },
      orderBy: { creeLe: "desc" },
    });
    expect(challengeConsomme!.consumedAt).not.toBeNull();

    // Rejouer le même code doit échouer immédiatement (single-use)
    await expect(service.verifierOtp(telephone, codeDemo)).rejects.toThrow(
      ErreurMetier,
    );

    // La session est persistée avec empreinte en base
    const session = await prisma.session.findFirst({
      where: { accountId: resultat.visiteurId },
      orderBy: { creeLe: "desc" },
    });
    expect(session).toBeDefined();
    expect(session!.tokenHash).not.toBe(resultat.token);
    expect(session!.revokedAt).toBeNull();

    // Résolution d'identité via le jeton de session
    const visiteurIdResolu = await service.exigerVisiteur(resultat.token);
    expect(visiteurIdResolu).toBe(resultat.visiteurId);
  });

  it("incrémente le compteur de tentatives en cas de mauvais code et bloque au maximum", async () => {
    const telephone = "773334455";
    await service.envoyerOtp(telephone);

    // 4 tentatives erronées
    for (let i = 0; i < 4; i++) {
      await expect(service.verifierOtp(telephone, "000000")).rejects.toThrow(
        ErreurMetier,
      );
    }

    const challenge = await prisma.otpChallenge.findFirst({
      where: { destination: telephone },
      orderBy: { creeLe: "desc" },
    });
    expect(challenge!.attempts).toBe(4);

    // 5ème tentative erronée -> verrouillage
    await expect(service.verifierOtp(telephone, "000000")).rejects.toThrow(
      ErreurMetier,
    );

    // Même avec le bon code, le challenge est verrouillé et rejeté
    await expect(service.verifierOtp(telephone, "123456")).rejects.toThrow(
      ErreurMetier,
    );
  });

  it("supporte la déconnexion en révoquant la session en base de données", async () => {
    const telephone = "774445566";
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { token, visiteurId } = await service.verifierOtp(telephone, codeDemo);

    // Session valide avant déconnexion
    const avant = await service.exigerVisiteur(token);
    expect(avant).toBe(visiteurId);

    // Déconnexion
    await service.deconnecter(token);

    // Vérification que la session est révoquée en base
    const session = await prisma.session.findFirst({
      where: { accountId: visiteurId },
      orderBy: { creeLe: "desc" },
    });
    expect(session!.revokedAt).not.toBeNull();

    // Après révocation, l'accès est refusé
    await expect(service.exigerVisiteur(token)).rejects.toThrow(ErreurMetier);
  });
});
