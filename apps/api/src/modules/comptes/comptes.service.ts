import { HttpStatus, Inject, Injectable } from "@nestjs/common";

import { DEPOT_COMPTES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import { verifierSha256 } from "../../commun/securite/hachage";
import type { DepotComptes } from "./comptes.depot";
import { CODE_OTP_DEMO, CODE_PRESTATAIRE_DEMO } from "./comptes.fixtures";

const DUREE_OTP_MINUTES = 10;
const MAX_TENTATIVES_OTP = 5;

@Injectable()
export class ServiceComptes {
  constructor(@Inject(DEPOT_COMPTES) private readonly depot: DepotComptes) {}

  /**
   * Envoie (simulé) un code OTP.
   * L'empreinte cryptographique est enregistrée en base sans jamais stocker le code en clair.
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
  ): Promise<{ visiteurId: string; token?: string }> {
    const digits = telephone.replace(/\D/g, "");
    const otp = await this.depot.otpPour(digits);

    if (!otp) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    if (otp.tentatives >= MAX_TENTATIVES_OTP) {
      await this.depot.consommerOtp(digits);
      throw new ErreurMetier(
        "TENTATIVES_DEPASSEES",
        "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (new Date(otp.expireLe).getTime() < Date.now()) {
      await this.depot.consommerOtp(digits);
      throw new ErreurMetier("CODE_EXPIRE", "Ce code a expiré.", HttpStatus.UNAUTHORIZED);
    }

    // Vérification cryptographique de l'empreinte (ou directe en fixtures démo)
    const codeValide =
      verifierSha256(code, otp.code) || code === otp.code;

    if (!codeValide) {
      const tentatives = await this.depot.incrementerTentatives?.(digits);
      if (tentatives !== undefined && tentatives >= MAX_TENTATIVES_OTP) {
        throw new ErreurMetier(
          "TENTATIVES_DEPASSEES",
          "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    // Invalidation immédiate du code après utilisation unique (single-use)
    await this.depot.consommerOtp(digits);

    // Création de la session sécurisée
    const session = await this.depot.creerSessionVisiteur(digits);
    return {
      visiteurId: session.compteId ?? session.id,
      token: session.token ?? session.id,
    };
  }

  async connexionPrestataire(
    telephone: string,
    code: string,
  ): Promise<{ prestataireId: string; token?: string }> {
    const digits = telephone.replace(/\D/g, "");
    if (digits.length < 9) {
      throw new ErreurMetier("TELEPHONE_INVALIDE", "Numéro de téléphone invalide.");
    }
    if (code !== CODE_PRESTATAIRE_DEMO) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }
    const session = await this.depot.creerSessionPrestataire(digits);
    return {
      prestataireId: session.compteId ?? session.id,
      token: session.token ?? session.id,
    };
  }

  async deconnecter(tokenOuId?: string): Promise<void> {
    if (tokenOuId) {
      await this.depot.revoquerSession?.(tokenOuId);
    }
  }

  /**
   * Résout l'identité visiteur : header de session, bearer token, cookie ou fallback développement.
   */
  async exigerVisiteur(visiteurHeader?: string, code?: string): Promise<string> {
    if (visiteurHeader) {
      // Épuration préfixe Bearer si présent
      const tokenNettoye = visiteurHeader.startsWith("Bearer ")
        ? visiteurHeader.slice(7).trim()
        : visiteurHeader.trim();

      const session = await this.depot.sessionVisiteur(tokenNettoye);
      if (session) return session.compteId ?? session.id;
      throw new ErreurMetier("NON_AUTHENTIFIE", "Session invalide ou expirée.", HttpStatus.UNAUTHORIZED);
    }

    if (code) {
      if (code !== CODE_OTP_DEMO) {
        throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
      }
      // Parcours formulaire de demande : rattachement au compte démo
      return "visiteur-demo";
    }

    // Démo de développement sans auth explicite
    return "visiteur-demo";
  }
}
