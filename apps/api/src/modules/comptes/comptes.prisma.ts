import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../base-de-donnees/prisma.service";
import {
  genererJetonSession,
  hacherJetonDirect,
  hacherOtp,
  hacherSha256,
  normaliserDestination,
  normaliserTelephone,
} from "../../commun/securite/hachage";
import type {
  CodeOtp,
  DepotComptes,
  SessionPrestataire,
  SessionVisiteur,
  VerificationRateLimit,
} from "./comptes.depot";

@Injectable()
export class DepotComptesPrisma implements DepotComptes {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enregistrerOtp(otp: CodeOtp): Promise<void> {
    const destination = normaliserDestination(otp.destination || otp.telephone || "");
    const estEmail = destination.includes("@");

    await this.prisma.$transaction(async (tx) => {
      // 1. Assure l'existence du compte visiteur (par e-mail ou téléphone)
      const account = estEmail
        ? await tx.account.upsert({
            where: { email: destination },
            update: {},
            create: {
              email: destination,
              role: "VISITEUR",
              typeCompte: "VISITEUR",
              estVerifie: false,
            },
          })
        : await tx.account.upsert({
            where: { telephone: destination },
            update: {},
            create: {
              telephone: destination,
              role: "VISITEUR",
              typeCompte: "VISITEUR",
              estVerifie: false,
            },
          });

      // 2. Invalide atomiquement les challenges précédents non consommés
      await tx.otpChallenge.updateMany({
        where: { destination, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      // 3. Enregistre l'empreinte HMAC-SHA-256 avec clé secrète dédiée (protège contre la recherche exhaustive)
      await tx.otpChallenge.create({
        data: {
          destination,
          ipAddress: otp.ipAddress,
          finalite: "connexion_visiteur",
          codeHash: hacherOtp(otp.code),
          attempts: otp.tentatives ?? 0,
          maxAttempts: 5,
          expiresAt: new Date(otp.expireLe),
          accountId: account.id,
        },
      });
    });
  }

  async verifierRateLimit(
    destination: string,
    ipAddress?: string,
  ): Promise<VerificationRateLimit> {
    const dest = normaliserDestination(destination);

    // 1. Délai minimal entre deux envois (cooldown de 60 secondes)
    const soixanteSecondes = new Date(Date.now() - 60_000);
    const recent = await this.prisma.otpChallenge.findFirst({
      where: {
        destination: dest,
        creeLe: { gte: soixanteSecondes },
      },
      orderBy: { creeLe: "desc" },
    });

    if (recent) {
      const tempsEcouleMs = Date.now() - recent.creeLe.getTime();
      const delaiRestantSecondes = Math.max(1, Math.ceil((60_000 - tempsEcouleMs) / 1000));
      return {
        autorise: false,
        motif: "cooldown",
        delaiRestantSecondes,
      };
    }

    // 2. Quota maximal par destination (5 par heure)
    const uneHeure = new Date(Date.now() - 3600_000);
    const countDestination = await this.prisma.otpChallenge.count({
      where: {
        destination: dest,
        creeLe: { gte: uneHeure },
      },
    });

    if (countDestination >= 5) {
      return { autorise: false, motif: "quota_destination" };
    }

    // 3. Quota maximal par IP (20 par heure)
    if (ipAddress) {
      const countIp = await this.prisma.otpChallenge.count({
        where: {
          ipAddress,
          creeLe: { gte: uneHeure },
        },
      });

      if (countIp >= 20) {
        return { autorise: false, motif: "quota_ip" };
      }
    }

    return { autorise: true };
  }

  async otpPour(destination: string): Promise<CodeOtp | null> {
    const dest = normaliserDestination(destination);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        destination: dest,
        consumedAt: null,
      },
      orderBy: { creeLe: "desc" },
    });

    if (!challenge) return null;

    return {
      id: challenge.id,
      destination: challenge.destination,
      telephone: challenge.destination,
      code: challenge.codeHash, // Contient l'empreinte pour vérification sécurisée
      expireLe: challenge.expiresAt.toISOString(),
      tentatives: challenge.attempts,
      ipAddress: challenge.ipAddress ?? undefined,
    };
  }

  async incrementerTentatives(destination: string): Promise<number> {
    const dest = normaliserDestination(destination);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { destination: dest, consumedAt: null },
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

  async consommerOtp(idOuDestination: string): Promise<boolean> {
    const res = await this.prisma.otpChallenge.updateMany({
      where: {
        OR: [
          { id: idOuDestination },
          { destination: normaliserDestination(idOuDestination) },
        ],
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    return res.count > 0;
  }

  async creerSessionVisiteur(destination: string): Promise<SessionVisiteur> {
    const dest = normaliserDestination(destination);
    const estEmail = dest.includes("@");

    const account = estEmail
      ? await this.prisma.account.upsert({
          where: { email: dest },
          update: { estVerifie: true, verifieLe: new Date() },
          create: {
            email: dest,
            role: "VISITEUR",
            typeCompte: "VISITEUR",
            estVerifie: true,
            verifieLe: new Date(),
          },
        })
      : await this.prisma.account.upsert({
          where: { telephone: dest },
          update: { estVerifie: true, verifieLe: new Date() },
          create: {
            telephone: dest,
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
      destination: dest,
      telephone: account.telephone ?? undefined,
      email: account.email ?? undefined,
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
