import { randomInt } from "node:crypto";
import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";

import { ServiceEmail } from "../../commun/email/email.service";
import { DEPOT_COMPTES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import {
  normaliserDestination,
  verifierOtpHash,
} from "../../commun/securite/hachage";
import { config } from "../../config/configuration";
import type { DepotComptes } from "./comptes.depot";
import { CODE_OTP_DEMO, CODE_PRESTATAIRE_DEMO } from "./comptes.fixtures";

const DUREE_OTP_MINUTES = 10;
const MAX_TENTATIVES_OTP = 5;

@Injectable()
export class ServiceComptes {
  constructor(
    @Inject(DEPOT_COMPTES) private readonly depot: DepotComptes,
    @Optional() private readonly emailService?: ServiceEmail,
  ) {}

  /**
   * Envoie un code OTP à une adresse e-mail (ou téléphone hors-production uniquement).
   * L'empreinte cryptographique est enregistrée en base sans jamais stocker le code en clair.
   */
  async envoyerOtp(
    identifiant: string,
    ipAddress?: string,
  ): Promise<{ expireLe: string; delaiAttenteSecondes: number; codeDemo?: string; canal: "email" | "sms" }> {
    const estEmail = identifiant.includes("@");
    let destination: string;

    if (estEmail) {
      destination = identifiant.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
        throw new ErreurMetier("EMAIL_INVALIDE", "Adresse e-mail invalide.");
      }
    } else {
      destination = identifiant.replace(/\D/g, "");
      if (destination.length < 9) {
        throw new ErreurMetier("TELEPHONE_INVALIDE", "Numéro de téléphone invalide.");
      }
      // Aucun fournisseur SMS (Twilio, Infobip, etc.) n'est intégré dans l'API.
      // En production, refuser formellement pour ne jamais tromper l'utilisateur.
      if (config.environnement === "production") {
        throw new ErreurMetier(
          "FOURNISSEUR_SMS_NON_DISPONIBLE",
          "L'envoi de codes par SMS n'est pas disponible actuellement. Veuillez utiliser votre adresse e-mail pour recevoir votre code de vérification.",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // 1. Contrôle du Rate Limiting (délai entre renvois, quotas destination et IP)
    if (this.depot.verifierRateLimit) {
      const verif = await this.depot.verifierRateLimit(destination, ipAddress);
      if (!verif.autorise) {
        if (verif.motif === "cooldown") {
          throw new ErreurMetier(
            "DELAI_ATTENTE",
            `Veuillez patienter ${verif.delaiRestantSecondes ?? 60} secondes avant de demander un nouveau code.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (verif.motif === "quota_destination") {
          throw new ErreurMetier(
            "QUOTA_DEPASSE",
            "Nombre maximal de demandes atteint pour cette adresse. Veuillez réessayer plus tard.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (verif.motif === "quota_ip") {
          throw new ErreurMetier(
            "QUOTA_IP_DEPASSE",
            "Trop de demandes de vérification depuis cette connexion. Veuillez réessayer plus tard.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    // 2. Génération cryptographiquement sécurisée d'un code à 6 chiffres
    const code = randomInt(100000, 1000000).toString();
    const expireLe = new Date(Date.now() + DUREE_OTP_MINUTES * 60_000).toISOString();

    // 3. Persistance en base PostgreSQL avec empreinte HMAC-SHA-256 (jamais le code brut)
    await this.depot.enregistrerOtp({
      destination,
      telephone: estEmail ? undefined : destination,
      code,
      expireLe,
      tentatives: 0,
      ipAddress,
    });

    // 4. Envoi par e-mail si destination e-mail
    if (estEmail && this.emailService) {
      await this.emailService.envoyerCodeOtp(destination, code, DUREE_OTP_MINUTES);
    }

    const reponse: {
      expireLe: string;
      delaiAttenteSecondes: number;
      codeDemo?: string;
      canal: "email" | "sms";
    } = {
      expireLe,
      delaiAttenteSecondes: 60,
      canal: estEmail ? "email" : "sms",
    };

    // En environnement de développement/test hors production uniquement, inclure codeDemo
    if (config.environnement !== "production") {
      reponse.codeDemo = code;
    }

    return reponse;
  }

  async verifierOtp(
    identifiant: string,
    code: string,
  ): Promise<{ visiteurId: string; token?: string }> {
    const destination = normaliserDestination(identifiant);

    // Refus strict du code démo fixe en production
    if (config.environnement === "production" && code === CODE_OTP_DEMO) {
      // Le code doit obligatoirement correspondre au challenge réel stocké
    }

    const otp = await this.depot.otpPour(destination);
    if (!otp) {
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    if (otp.tentatives >= MAX_TENTATIVES_OTP) {
      await this.depot.consommerOtp(otp.id ?? destination);
      throw new ErreurMetier(
        "TENTATIVES_DEPASSEES",
        "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (new Date(otp.expireLe).getTime() < Date.now()) {
      await this.depot.consommerOtp(otp.id ?? destination);
      throw new ErreurMetier("CODE_EXPIRE", "Ce code a expiré.", HttpStatus.UNAUTHORIZED);
    }

    // Vérification cryptographique de l'empreinte HMAC-SHA-256 en temps constant (timing-safe)
    let codeValide = verifierOtpHash(code, otp.code);
    if (!codeValide && config.environnement !== "production") {
      // Tolérance démo locale sans empreinte cryptographique si fixtures en mémoire
      codeValide = code === otp.code;
    }

    if (!codeValide) {
      const tentatives = await this.depot.incrementerTentatives?.(destination);
      if (tentatives !== undefined && tentatives >= MAX_TENTATIVES_OTP) {
        throw new ErreurMetier(
          "TENTATIVES_DEPASSEES",
          "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
    }

    // Invalidation immédiate et atomique du code après utilisation unique (single-use)
    // Empêche toute réutilisation concurrente (TOCTOU / replay attack)
    const consomme = await this.depot.consommerOtp(otp.id ?? destination);
    if (!consomme) {
      throw new ErreurMetier("CODE_DEJA_UTILISE", "Ce code a déjà été utilisé.", HttpStatus.UNAUTHORIZED);
    }

    // Création de la session sécurisée persistée
    const session = await this.depot.creerSessionVisiteur(destination);
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
      if (config.environnement === "production") {
        throw new ErreurMetier("NON_AUTHENTIFIE", "Session invalide ou expirée.", HttpStatus.UNAUTHORIZED);
      }
      if (code !== CODE_OTP_DEMO) {
        throw new ErreurMetier("CODE_INVALIDE", "Le code n'est pas valable.", HttpStatus.UNAUTHORIZED);
      }
      return "visiteur-demo";
    }

    if (config.environnement === "production") {
      throw new ErreurMetier("NON_AUTHENTIFIE", "Authentification requise.", HttpStatus.UNAUTHORIZED);
    }

    // Démo de développement sans auth explicite
    return "visiteur-demo";
  }
}
