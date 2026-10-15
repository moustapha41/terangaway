import { Injectable } from "@nestjs/common";

import { normaliserDestination } from "../../commun/securite/hachage";
import type {
  CodeOtp,
  DepotComptes,
  SessionPrestataire,
  SessionVisiteur,
  VerificationRateLimit,
} from "./comptes.depot";

/** Code OTP de démonstration — aucun SMS réel. */
export const CODE_OTP_DEMO = "123456";

/** Code prestataire de démonstration — aligné sur `@teranga/fixtures`. */
export const CODE_PRESTATAIRE_DEMO = "123456";

@Injectable()
export class DepotComptesFixtures implements DepotComptes {
  private readonly otps = new Map<string, CodeOtp>();
  private readonly sessionsVisiteur = new Map<string, SessionVisiteur>();
  private readonly sessionsPrestataire = new Map<string, SessionPrestataire>();
  private readonly historiquesEnvois = new Map<string, number[]>();

  async enregistrerOtp(otp: CodeOtp): Promise<void> {
    const dest = normaliserDestination(otp.destination || otp.telephone || "");
    this.otps.set(dest, {
      ...otp,
      destination: dest,
      telephone: dest,
    });

    const timestamps = this.historiquesEnvois.get(dest) ?? [];
    timestamps.push(Date.now());
    this.historiquesEnvois.set(dest, timestamps);
  }

  async verifierRateLimit(
    destination: string,
    _ipAddress?: string,
  ): Promise<VerificationRateLimit> {
    const dest = normaliserDestination(destination);
    const timestamps = this.historiquesEnvois.get(dest) ?? [];
    const maintenant = Date.now();

    // 60s cooldown
    const dernier = timestamps[timestamps.length - 1];
    if (dernier && maintenant - dernier < 60_000) {
      const restant = Math.ceil((60_000 - (maintenant - dernier)) / 1000);
      return { autorise: false, motif: "cooldown", delaiRestantSecondes: restant };
    }

    // Max 5 par heure
    const uneHeure = timestamps.filter((t) => maintenant - t < 3600_000);
    if (uneHeure.length >= 5) {
      return { autorise: false, motif: "quota_destination" };
    }

    return { autorise: true };
  }

  async otpPour(destination: string): Promise<CodeOtp | null> {
    return this.otps.get(normaliserDestination(destination)) ?? null;
  }

  async incrementerTentatives(destination: string): Promise<number> {
    const dest = normaliserDestination(destination);
    const otp = this.otps.get(dest);
    if (!otp) return 0;
    otp.tentatives = (otp.tentatives ?? 0) + 1;
    if (otp.tentatives >= 5) {
      this.otps.delete(dest);
    }
    return otp.tentatives;
  }

  async consommerOtp(destination: string): Promise<boolean> {
    const norm = normaliserDestination(destination);
    return this.otps.delete(norm);
  }

  async creerSessionVisiteur(destination: string): Promise<SessionVisiteur> {
    const dest = normaliserDestination(destination);
    const session: SessionVisiteur = {
      id: `visiteur-${dest}`,
      destination: dest,
      telephone: dest.includes("@") ? undefined : dest,
      email: dest.includes("@") ? dest : undefined,
      creeLe: new Date().toISOString(),
      token: `tws_fixture_${dest}`,
    };
    this.sessionsVisiteur.set(session.id, session);
    this.sessionsVisiteur.set(session.token!, session);
    return session;
  }

  async sessionVisiteur(id: string): Promise<SessionVisiteur | null> {
    if (id === "visiteur-demo") {
      return {
        id: "visiteur-demo",
        destination: "770000000",
        telephone: "770000000",
        creeLe: new Date().toISOString(),
      };
    }
    return this.sessionsVisiteur.get(id) ?? null;
  }

  async creerSessionPrestataire(telephone: string): Promise<SessionPrestataire> {
    const session: SessionPrestataire = {
      id: `prestataire-${normaliserDestination(telephone)}`,
      telephone: normaliserDestination(telephone),
      creeLe: new Date().toISOString(),
    };
    this.sessionsPrestataire.set(session.id, session);
    return session;
  }

  async sessionPrestataire(id: string): Promise<SessionPrestataire | null> {
    return this.sessionsPrestataire.get(id) ?? null;
  }
}
