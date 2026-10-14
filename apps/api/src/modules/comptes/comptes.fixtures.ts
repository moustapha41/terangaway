import { Injectable } from "@nestjs/common";

import type {
  CodeOtp,
  DepotComptes,
  SessionPrestataire,
  SessionVisiteur,
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

  async enregistrerOtp(otp: CodeOtp): Promise<void> {
    this.otps.set(normaliserTelephone(otp.telephone), otp);
  }

  async otpPour(telephone: string): Promise<CodeOtp | null> {
    return this.otps.get(normaliserTelephone(telephone)) ?? null;
  }

  async consommerOtp(telephone: string): Promise<void> {
    this.otps.delete(normaliserTelephone(telephone));
  }

  async creerSessionVisiteur(telephone: string): Promise<SessionVisiteur> {
    const session: SessionVisiteur = {
      id: `visiteur-${normaliserTelephone(telephone)}`,
      telephone: normaliserTelephone(telephone),
      creeLe: new Date().toISOString(),
    };
    // Session démo stable : un même téléphone retrouve le même id.
    this.sessionsVisiteur.set(session.id, session);
    return session;
  }

  async sessionVisiteur(id: string): Promise<SessionVisiteur | null> {
    if (id === "visiteur-demo") {
      return {
        id: "visiteur-demo",
        telephone: "770000000",
        creeLe: new Date().toISOString(),
      };
    }
    return this.sessionsVisiteur.get(id) ?? null;
  }

  async creerSessionPrestataire(telephone: string): Promise<SessionPrestataire> {
    const session: SessionPrestataire = {
      id: `prestataire-${normaliserTelephone(telephone)}`,
      telephone: normaliserTelephone(telephone),
      creeLe: new Date().toISOString(),
    };
    this.sessionsPrestataire.set(session.id, session);
    return session;
  }

  async sessionPrestataire(id: string): Promise<SessionPrestataire | null> {
    return this.sessionsPrestataire.get(id) ?? null;
  }
}

function normaliserTelephone(telephone: string): string {
  return telephone.replace(/\D/g, "");
}
