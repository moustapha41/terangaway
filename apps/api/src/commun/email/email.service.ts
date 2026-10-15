import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Resend } from "resend";

import { config } from "../../config/configuration";
import { ErreurMetier } from "../erreurs";
import { genererEmailOtp } from "./modeles/otp.modele";

export const RESEND_CLIENT = "RESEND_CLIENT";

@Injectable()
export class ServiceEmail {
  private readonly logger = new Logger(ServiceEmail.name);
  private readonly resend: Resend | null = null;

  constructor(
    @Optional()
    @Inject(RESEND_CLIENT)
    clientInjecte?: Resend,
  ) {
    if (clientInjecte) {
      this.resend = clientInjecte;
    } else if (config.resendApiKey) {
      this.resend = new Resend(config.resendApiKey);
    }
  }

  /**
   * Envoie un code OTP sécurisé par e-mail via l'API Resend.
   * En cas d'erreur de Resend, lève une ErreurMetier pour ne jamais prétendre
   * que l'e-mail est parti avec succès.
   */
  async envoyerCodeOtp(
    email: string,
    code: string,
    minutesValidite = 10,
  ): Promise<{ id: string }> {
    const destinataire = email.trim().toLowerCase();
    const modele = genererEmailOtp(code, minutesValidite);

    if (!this.resend) {
      if (config.environnement === "production") {
        this.logger.error("Tentative d'envoi d'e-mail en production sans clé RESEND_API_KEY");
        throw new ErreurMetier(
          "SERVICE_EMAIL_NON_CONFIGURE",
          "Le service d'envoi d'e-mails n'est pas configuré.",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.warn(
        `[Mode développement/test] E-mail simulé vers ${destinataire}. Code: ${code}`,
      );
      return { id: "simule-local" };
    }

    try {
      const reponse = await this.resend.emails.send({
        from: config.emailFrom,
        to: destinataire,
        subject: modele.sujet,
        html: modele.html,
        text: modele.texte,
      });

      if (reponse.error) {
        this.logger.error(
          `Erreur retournée par Resend pour ${destinataire}: ${reponse.error.name} - ${reponse.error.message}`,
        );
        throw new ErreurMetier(
          "ECHEC_ENVOI_EMAIL",
          "Impossible d'envoyer l'e-mail de vérification. Veuillez vérifier votre adresse ou réessayer.",
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(`E-mail OTP envoyé avec succès à ${destinataire} (id: ${reponse.data?.id})`);
      return { id: reponse.data?.id ?? "envoye" };
    } catch (erreur) {
      if (erreur instanceof ErreurMetier) {
        throw erreur;
      }
      const message = (erreur as Error)?.message ?? "Erreur inconnue";
      this.logger.error(`Exception inattendue Resend vers ${destinataire}: ${message}`);
      throw new ErreurMetier(
        "ECHEC_ENVOI_EMAIL",
        "Impossible d'envoyer l'e-mail de vérification. Veuillez vérifier votre adresse ou réessayer.",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
