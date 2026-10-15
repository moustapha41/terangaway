import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../base-de-donnees/prisma.service";
import {
  genererJetonSession,
  hacherJetonDirect,
  hacherSha256,
  normaliserTelephone,
} from "../../commun/securite/hachage";
import type {
  CodeOtp,
  DepotComptes,
  SessionPrestataire,
  SessionVisiteur,
} from "./comptes.depot";

@Injectable()
export class DepotComptesPrisma implements DepotComptes {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enregistrerOtp(otp: CodeOtp): Promise<void> {
    const telephone = normaliserTelephone(otp.telephone);

    // Assure l'existence du compte visiteur
    const account = await this.prisma.account.upsert({
      where: { telephone },
      update: {},
      create: {
        telephone,
        role: "VISITEUR",
        typeCompte: "VISITEUR",
        estVerifie: false,
      },
    });

    // Invalide les challenges précédents non consommés
    await this.prisma.otpChallenge.updateMany({
      where: { destination: telephone, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // Enregistre l'empreinte cryptographique du code OTP (jamais le code en clair)
    await this.prisma.otpChallenge.create({
      data: {
        destination: telephone,
        finalite: "connexion_visiteur",
        codeHash: hacherSha256(otp.code),
        attempts: otp.tentatives ?? 0,
        maxAttempts: 5,
        expiresAt: new Date(otp.expireLe),
        accountId: account.id,
      },
    });
  }

  async otpPour(telephone: string): Promise<CodeOtp | null> {
    const digits = normaliserTelephone(telephone);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        destination: digits,
        consumedAt: null,
      },
      orderBy: { creeLe: "desc" },
    });

    if (!challenge) return null;

    return {
      telephone: challenge.destination,
      code: challenge.codeHash, // Contient l'empreinte pour vérification sécurisée
      expireLe: challenge.expiresAt.toISOString(),
      tentatives: challenge.attempts,
    };
  }

  async incrementerTentatives(telephone: string): Promise<number> {
    const digits = normaliserTelephone(telephone);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { destination: digits, consumedAt: null },
      orderBy: { creeLe: "desc" },
    });

    if (!challenge) return 0;

    const misAJour = await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });

    if (misAJour.attempts >= misAJour.maxAttempts) {
      // Dépassement des tentatives : challenge consommé et invalidé
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
    }

    return misAJour.attempts;
  }

  async consommerOtp(telephone: string): Promise<void> {
    const digits = normaliserTelephone(telephone);
    await this.prisma.otpChallenge.updateMany({
      where: { destination: digits, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async creerSessionVisiteur(telephone: string): Promise<SessionVisiteur> {
    const digits = normaliserTelephone(telephone);

    const account = await this.prisma.account.upsert({
      where: { telephone: digits },
      update: { estVerifie: true, verifieLe: new Date() },
      create: {
        telephone: digits,
        role: "VISITEUR",
        typeCompte: "VISITEUR",
        estVerifie: true,
        verifieLe: new Date(),
      },
    });

    const token = genererJetonSession();
    const tokenHash = hacherJetonDirect(token);
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000); // 8 heures

    const session = await this.prisma.session.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      id: session.id,
      telephone: digits,
      creeLe: session.creeLe.toISOString(),
      compteId: account.id,
      token,
    };
  }

  async sessionVisiteur(idOuToken: string): Promise<SessionVisiteur | null> {
    // 1. Démo isolée de développement
    if (idOuToken === "visiteur-demo") {
      const demo = await this.prisma.account.upsert({
        where: { id: "visiteur-demo" },
        update: {},
        create: {
          id: "visiteur-demo",
          telephone: "770000000",
          nom: "Visiteur Démo",
          role: "VISITEUR",
          typeCompte: "VISITEUR",
          estVerifie: true,
          verifieLe: new Date(),
        },
      });
      return {
        id: demo.id,
        telephone: demo.telephone ?? "770000000",
        creeLe: demo.creeLe.toISOString(),
        compteId: demo.id,
      };
    }

    const maintenant = new Date();

    // 2. Recherche par empreinte de jeton session
    const tokenHash = hacherJetonDirect(idOuToken);
    const sessionParToken = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (
      sessionParToken &&
      !sessionParToken.revokedAt &&
      sessionParToken.expiresAt > maintenant
    ) {
      return {
        id: sessionParToken.id,
        telephone: sessionParToken.account.telephone ?? "",
        creeLe: sessionParToken.creeLe.toISOString(),
        compteId: sessionParToken.accountId,
        token: idOuToken,
      };
    }

    // 3. Recherche par identifiant de session
    const sessionParId = await this.prisma.session.findUnique({
      where: { id: idOuToken },
      include: { account: true },
    });

    if (
      sessionParId &&
      !sessionParId.revokedAt &&
      sessionParId.expiresAt > maintenant
    ) {
      return {
        id: sessionParId.id,
        telephone: sessionParId.account.telephone ?? "",
        creeLe: sessionParId.creeLe.toISOString(),
        compteId: sessionParId.accountId,
      };
    }

    // 4. Recherche par identifiant de compte (compatibilité de transition)
    const account = await this.prisma.account.findUnique({
      where: { id: idOuToken },
    });
    if (account) {
      return {
        id: account.id,
        telephone: account.telephone ?? "",
        creeLe: account.creeLe.toISOString(),
        compteId: account.id,
      };
    }

    return null;
  }

  async creerSessionPrestataire(telephone: string): Promise<SessionPrestataire> {
    const digits = normaliserTelephone(telephone);

    const account = await this.prisma.account.upsert({
      where: { telephone: digits },
      update: { estVerifie: true, verifieLe: new Date() },
      create: {
        telephone: digits,
        role: "PRESTATAIRE",
        typeCompte: "LES_DEUX",
        estVerifie: true,
        verifieLe: new Date(),
      },
    });

    const token = genererJetonSession();
    const tokenHash = hacherJetonDirect(token);
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000);

    const session = await this.prisma.session.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      id: session.id,
      telephone: digits,
      creeLe: session.creeLe.toISOString(),
      compteId: account.id,
      token,
    };
  }

  async sessionPrestataire(idOuToken: string): Promise<SessionPrestataire | null> {
    if (idOuToken === "prestataire-demo") {
      const demo = await this.prisma.account.upsert({
        where: { id: "prestataire-demo" },
        update: {},
        create: {
          id: "prestataire-demo",
          telephone: "771234567",
          nom: "Prestataire Démo",
          role: "PRESTATAIRE",
          typeCompte: "LES_DEUX",
          estVerifie: true,
          verifieLe: new Date(),
        },
      });
      return {
        id: demo.id,
        telephone: demo.telephone ?? "771234567",
        creeLe: demo.creeLe.toISOString(),
        compteId: demo.id,
      };
    }

    const maintenant = new Date();
    const tokenHash = hacherJetonDirect(idOuToken);

    const sessionParToken = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (
      sessionParToken &&
      !sessionParToken.revokedAt &&
      sessionParToken.expiresAt > maintenant &&
      sessionParToken.account.role === "PRESTATAIRE"
    ) {
      return {
        id: sessionParToken.id,
        telephone: sessionParToken.account.telephone ?? "",
        creeLe: sessionParToken.creeLe.toISOString(),
        compteId: sessionParToken.accountId,
        token: idOuToken,
      };
    }

    const sessionParId = await this.prisma.session.findUnique({
      where: { id: idOuToken },
      include: { account: true },
    });

    if (
      sessionParId &&
      !sessionParId.revokedAt &&
      sessionParId.expiresAt > maintenant &&
      sessionParId.account.role === "PRESTATAIRE"
    ) {
      return {
        id: sessionParId.id,
        telephone: sessionParId.account.telephone ?? "",
        creeLe: sessionParId.creeLe.toISOString(),
        compteId: sessionParId.accountId,
      };
    }

    const account = await this.prisma.account.findUnique({
      where: { id: idOuToken },
    });
    if (account && account.role === "PRESTATAIRE") {
      return {
        id: account.id,
        telephone: account.telephone ?? "",
        creeLe: account.creeLe.toISOString(),
        compteId: account.id,
      };
    }

    return null;
  }

  async revoquerSession(idOuToken: string): Promise<void> {
    const maintenant = new Date();
    const tokenHash = hacherJetonDirect(idOuToken);

    await this.prisma.session.updateMany({
      where: {
        OR: [{ id: idOuToken }, { tokenHash }],
        revokedAt: null,
      },
      data: { revokedAt: maintenant },
    });
  }
}
