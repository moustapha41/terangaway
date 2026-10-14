import { Inject, Injectable } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";

import { DEPOT_COMPTES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import type { DepotComptes } from "./comptes.depot";
import { CODE_OTP_DEMO, CODE_PRESTATAIRE_DEMO } from "./comptes.fixtures";

const DUREE_OTP_MINUTES = 10;

@Injectable()
export class ServiceComptes {
  constructor(@Inject(DEPOT_COMPTES) private readonly depot: DepotComptes) {}

  /**
   * Envoie (simulé) un code OTP. En démo le code est toujours `123456`.
   */
  async envoyerOtp(telephone: string): Promise<{ expireLe: string; codeDemo: string }> {
    const digits = telephone.replace(/\D/g, "");
    if (digits.length < 9) {
      throw new ErreurMetier("TELEPHONE_INVALIDE", "Numéro de téléphone invalide.");
    }

    const expireLe = new Date(Date.now() + DUREE_OTP_MINUTES * 60_000).toISOString();
    await this.depot.enregistrerOtp({
      telephone: digits,
      code: CODE_OTP_DEMO,
      expireLe,
      tentatives: 0,
    });

    return { expireLe, codeDemo: CODE_OTP_DEMO };
  }

  async verifierOtp(
    telephone: string,
    code: string,
  ): Promise<{ visiteurId: string }> {
    const digits = telephone.replace(/\D/g, "");
    const otp = await this.depot.otpPour(digits);

    if (!otp) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }
    if (new Date(otp.expireLe).getTime() < Date.now()) {
      await this.depot.consommerOtp(digits);
      throw new ErreurMetier("CODE_EXPIRE", "Ce code a expiré.", HttpStatus.UNAUTHORIZED);
    }
    if (code !== otp.code) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    await this.depot.consommerOtp(digits);
    const session = await this.depot.creerSessionVisiteur(digits);
    return { visiteurId: session.id };
  }

  async connexionPrestataire(
    telephone: string,
    code: string,
  ): Promise<{ prestataireId: string }> {
    const digits = telephone.replace(/\D/g, "");
    if (digits.length < 9) {
      throw new ErreurMetier("TELEPHONE_INVALIDE", "Numéro de téléphone invalide.");
    }
    if (code !== CODE_PRESTATAIRE_DEMO) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }
    const session = await this.depot.creerSessionPrestataire(digits);
    return { prestataireId: session.id };
  }

  /**
   * Résout l'identité visiteur : header de session, ou code OTP fourni avec
   * un téléphone implicite de démo quand seul le code est envoyé (parcours demande).
   */
  async exigerVisiteur(visiteurHeader?: string, code?: string): Promise<string> {
    if (visiteurHeader) {
      const session = await this.depot.sessionVisiteur(visiteurHeader);
      if (session) return session.id;
      throw new ErreurMetier("NON_AUTHENTIFIE", "Session invalide.", HttpStatus.UNAUTHORIZED);
    }

    if (code) {
      if (code !== CODE_OTP_DEMO) {
        throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
      }
      // Parcours formulaire de demande : le mock acceptait le code seul.
      return "visiteur-demo";
    }

    // Démo sans auth : le catalogue de demandes fixtures est rattaché à cet id.
    return "visiteur-demo";
  }
}
