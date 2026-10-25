import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { enProduction } from "../../commun/securite/posture.test-utils";
import { DepotComptesPrisma } from "./comptes.prisma";
import { ServiceComptes } from "./comptes.service";

describe("Persistance PostgreSQL — Module Comptes & Authentification", () => {
  let service: ServiceComptes;
  let prisma: PrismaService;
  let depot: DepotComptesPrisma;

  const genererTel = () => `77${Math.floor(1000000 + Math.random() * 9000000)}`;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotComptesPrisma(prisma);
    service = new ServiceComptes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("génère un OTP avec empreinte cryptographique en base (jamais en clair)", async () => {
    const telephone = genererTel();
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
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);

    const resultat = await service.verifierOtp(telephone, codeDemo!);
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
    await expect(service.verifierOtp(telephone, codeDemo!)).rejects.toThrow(
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
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);

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
    await expect(service.verifierOtp(telephone, codeDemo!)).rejects.toThrow(
      ErreurMetier,
    );
  });

  it("supporte la déconnexion en révoquant la session en base de données", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { token, visiteurId } = await service.verifierOtp(telephone, codeDemo!);

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

  it("établit une session de 30 jours et rejette une session expirée", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { token, visiteurId } = await service.verifierOtp(telephone, codeDemo!);

    const session = await prisma.session.findFirst({
      where: { accountId: visiteurId },
      orderBy: { creeLe: "desc" },
    });
    expect(session).toBeDefined();

    // Vérifie que l'expiration est bien fixée à ~30 jours (+/- 1 heure de tolérance)
    const diffJours =
      (session!.expiresAt.getTime() - session!.creeLe.getTime()) /
      (1000 * 60 * 60 * 24);
    expect(Math.round(diffJours)).toBe(30);

    // Faire expirer la session artificiellement dans le passé
    await prisma.session.update({
      where: { id: session!.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60) },
    });

    // La session expirée doit être formellement rejetée
    await expect(service.exigerVisiteur(token)).rejects.toThrow(ErreurMetier);
  });

  it("fournit le profil visiteur complet avec email, téléphone et token", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { token, visiteurId } = await service.verifierOtp(telephone, codeDemo!);

    const profil = await service.profilVisiteur(token!);
    expect(profil.compteId).toBe(visiteurId);
    expect(profil.token).toBe(token);
    expect(profil.telephone).toContain(telephone);
  });

  it("rejette formellement visiteur-demo et les accountId arbitraires sans token valide en production", async () => {
    await enProduction(async () => {
      // 1. visiteur-demo est formellement rejeté
      await expect(service.exigerVisiteur("visiteur-demo")).rejects.toThrow(ErreurMetier);
      await expect(depot.sessionVisiteur("visiteur-demo")).resolves.toBeNull();

      // 2. Un simple identifiant de compte sans token valide est rejeté
      await expect(service.exigerVisiteur("acc_test_arbitraire")).rejects.toThrow(ErreurMetier);
      await expect(depot.sessionVisiteur("acc_test_arbitraire")).resolves.toBeNull();
    });
  });
});
