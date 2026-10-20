import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Resend } from "resend";

import { config } from "../../config/configuration";
import { ErreurMetier } from "../erreurs";
import { genererEmailDemande, type DetailsDemande } from "./modeles/demande.modele";
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
   * Confirme une demande à son auteur, et lui remet ses identifiants s'il
   * vient d'avoir un compte.
   *
   * **Ne lève jamais.** La demande est déjà enregistrée quand on arrive ici :
   * la faire échouer parce que Resend bégaie ferait perdre au visiteur une
   * demande qui est, elle, bel et bien partie chez le propriétaire. Un échec
   * s'écrit dans le journal et rien d'autre — jamais le mot de passe, qui ne
   * doit figurer nulle part ailleurs que dans l'e-mail.
   */
  async envoyerConfirmationDemande(
    email: string,
    details: Omit<DetailsDemande, "urlSite"> & { urlSite?: string },
  ): Promise<{ envoye: boolean }> {
    const destinataire = email.trim().toLowerCase();
    const modele = genererEmailDemande({ ...details, urlSite: details.urlSite ?? config.appUrl });

    if (!this.resend) {
      this.logger.warn(
        `[Sans Resend] Confirmation de ${details.reference} non envoyée à ${destinataire}.` +
          (details.identifiants ? " Des identifiants n'ont donc pas été remis." : ""),
      );
      return { envoye: false };
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
          `Confirmation de ${details.reference} refusée par Resend pour ${destinataire} : ${reponse.error.message}`,
        );
        return { envoye: false };
      }

      this.logger.log(
        `Confirmation de ${details.reference} envoyée à ${destinataire} (id: ${reponse.data?.id})`,
      );
      return { envoye: true };
    } catch (erreur) {
      const message = (erreur as Error)?.message ?? "Erreur inconnue";
      this.logger.error(`Confirmation de ${details.reference} non partie vers ${destinataire} : ${message}`);
      return { envoye: false };
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
      // Sans fournisseur, le mode démo écrit le code dans le journal. C'est
      // acceptable sur un poste de développement, jamais sur un déploiement :
      // les journaux sont consultables et conservés. Hors mode démo, on refuse
      // plutôt que de prétendre avoir envoyé l'e-mail.
      if (!config.autoriserComptesDemo) {
        this.logger.error("Tentative d'envoi d'e-mail sans clé RESEND_API_KEY configurée");
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
