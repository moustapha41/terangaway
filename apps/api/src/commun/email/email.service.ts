import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Resend } from "resend";

import { config } from "../../config/configuration";
import { ErreurMetier } from "../erreurs";
import { genererAlerteDemande, type AlerteDemande } from "./modeles/demande-equipe.modele";
import {
  genererEmailPartenaire,
  type DemandePartenaire,
} from "./modeles/demande-partenaire.modele";
import { genererRelanceEquipe, type LigneRelance } from "./modeles/relance-equipe.modele";
import { genererEmailDemande, type DetailsDemande } from "./modeles/demande.modele";
import { genererEmailOtp } from "./modeles/otp.modele";
import {
  genererEmailInstructionsAcompte,
  type InstructionsAcompte,
} from "./modeles/acompte.modele";

export const RESEND_CLIENT = "RESEND_CLIENT";

/**
 * Les refus de Resend qui méritent une nouvelle tentative : la surcharge et la
 * panne passagère. Une adresse invalide ou une clé révoquée échoueront aussi
 * la troisième fois — les réessayer ne ferait que retarder l'alerte.
 */
const ERREURS_PASSAGERES = new Set([
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
  "concurrent_idempotent_requests",
]);

export interface ResultatEnvoiAcompte {
  envoye: boolean;
  tentatives: number;
  /** Ce qui a fait échouer la dernière tentative. Jamais une coordonnée. */
  erreur?: string;
}

export interface OptionsEnvoi {
  /**
   * Rejouée avec chaque tentative : si la première est partie mais que sa
   * réponse s'est perdue, Resend reconnaît la suivante et n'envoie pas deux
   * fois. Un visiteur qui reçoit deux demandes de virement peut virer deux fois.
   */
  cleIdempotence: string;
  /** Pauses entre tentatives, en millisecondes. Leur nombre + 1 = tentatives. */
  pauses?: readonly number[];
}

const PAUSES_PAR_DEFAUT = [500, 2_000] as const;

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
   * Porte la demande au propriétaire, avec le lien qui décide.
   *
   * **Ne lève jamais** : la demande existe, et l'équipe est prévenue de son
   * côté. Si l'e-mail du propriétaire ne part pas, il reste joignable au
   * téléphone — ce qui n'est vrai que parce que l'alerte interne, elle, est
   * partie.
   */
  async envoyerDemandeAuPartenaire(
    email: string,
    demande: DemandePartenaire,
  ): Promise<{ envoye: boolean }> {
    const destinataire = email.trim().toLowerCase();
    const modele = genererEmailPartenaire(demande);

    if (!this.resend) {
      this.logger.warn(
        `[Sans Resend] Demande ${demande.reference} non portée à ${destinataire}.`,
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
          `Demande ${demande.reference} refusée par Resend pour ${destinataire} : ${reponse.error.message}`,
        );
        return { envoye: false };
      }

      this.logger.log(
        `Demande ${demande.reference} portée à ${destinataire} (id: ${reponse.data?.id})`,
      );
      return { envoye: true };
    } catch (erreur) {
      const message = (erreur as Error)?.message ?? "Erreur inconnue";
      this.logger.error(`Demande ${demande.reference} non portée à ${destinataire} : ${message}`);
      return { envoye: false };
    }
  }

  /**
   * Signale une demande à l'équipe, à l'instant où elle arrive.
   *
   * **Ne lève jamais**, pour la même raison que la confirmation du visiteur :
   * la demande est enregistrée, l'alerte n'est qu'un avertissement. Mais, à la
   * différence de la confirmation, un échec se journalise en `error` : si
   * personne n'est prévenu, il faut au moins que la trace existe quelque part.
   *
   * Sans destinataire, rien ne part — et c'est dit haut, car une alerte
   * adressée à une liste vide ressemble en tout point à une alerte qui marche.
   */
  async alerterEquipe(
    destinataires: readonly string[],
    alerte: AlerteDemande,
  ): Promise<{ envoye: boolean }> {
    const adresses = [...new Set(destinataires.map((a) => a.trim().toLowerCase()).filter(Boolean))];

    if (adresses.length === 0) {
      this.logger.error(
        `Demande ${alerte.reference} : aucune adresse d'équipe à prévenir. ` +
          "Donnez le rôle ADMINISTRATEUR à un compte, ou renseignez ADMIN_EMAILS.",
      );
      return { envoye: false };
    }

    if (!this.resend) {
      this.logger.warn(
        `[Sans Resend] Demande ${alerte.reference} non signalée à ${adresses.join(", ")}.`,
      );
      return { envoye: false };
    }

    const modele = genererAlerteDemande(alerte);

    try {
      const reponse = await this.resend.emails.send({
        from: config.emailFrom,
        to: adresses,
        subject: modele.sujet,
        html: modele.html,
        text: modele.texte,
      });

      if (reponse.error) {
        this.logger.error(
          `Alerte ${alerte.reference} refusée par Resend : ${reponse.error.message}`,
        );
        return { envoye: false };
      }

      this.logger.log(
        `Alerte ${alerte.reference} envoyée à ${adresses.length} adresse(s) (id: ${reponse.data?.id})`,
      );
      return { envoye: true };
    } catch (erreur) {
      const message = (erreur as Error)?.message ?? "Erreur inconnue";
      this.logger.error(`Alerte ${alerte.reference} non partie : ${message}`);
      return { envoye: false };
    }
  }

  /**
   * Relance l'équipe sur des demandes laissées sans réponse.
   *
   * Un seul message pour toutes : dix demandes en souffrance font dix lignes,
   * pas dix e-mails. **Ne lève jamais**, et le dit dans le journal quand rien
   * ne part — c'est le filet du filet.
   */
  async relancerEquipe(
    destinataires: readonly string[],
    lignes: readonly LigneRelance[],
  ): Promise<{ envoye: boolean }> {
    if (lignes.length === 0) return { envoye: false };

    const adresses = [...new Set(destinataires.map((a) => a.trim().toLowerCase()).filter(Boolean))];
    const references = lignes.map((l) => l.reference).join(", ");

    if (adresses.length === 0) {
      this.logger.error(`Relance impossible (${references}) : aucune adresse d'équipe.`);
      return { envoye: false };
    }

    if (!this.resend) {
      this.logger.warn(`[Sans Resend] Relance non envoyée pour ${references}.`);
      return { envoye: false };
    }

    const modele = genererRelanceEquipe(lignes);

    try {
      const reponse = await this.resend.emails.send({
        from: config.emailFrom,
        to: adresses,
        subject: modele.sujet,
        html: modele.html,
        text: modele.texte,
      });

      if (reponse.error) {
        this.logger.error(`Relance refusée par Resend (${references}) : ${reponse.error.message}`);
        return { envoye: false };
      }

      this.logger.log(`Relance envoyée pour ${lignes.length} demande(s) : ${references}`);
      return { envoye: true };
    } catch (erreur) {
      const message = (erreur as Error)?.message ?? "Erreur inconnue";
      this.logger.error(`Relance non partie (${references}) : ${message}`);
      return { envoye: false };
    }
  }

  /**
   * Envoie les instructions de virement d'un acompte.
   *
   * **Ne lève jamais** : la demande est acceptée quand on arrive ici, et un
   * e-mail qui échoue ne doit pas la défaire. Mais l'échec est **rendu** à
   * l'appelant, pas seulement journalisé : c'est lui qui décide de ne pas
   * poser le marqueur d'envoi, pour qu'un renvoi reste possible.
   *
   * Plusieurs tentatives pour les seules pannes passagères, toutes avec la même
   * clé d'idempotence.
   */
  async envoyerInstructionsAcompte(
    email: string,
    details: InstructionsAcompte,
    options: OptionsEnvoi,
  ): Promise<ResultatEnvoiAcompte> {
    const destinataire = email.trim().toLowerCase();

    if (!this.resend) {
      this.logger.error(
        `[Sans Resend] Instructions d'acompte de ${details.reference} non envoyées à ${destinataire}.`,
      );
      return { envoye: false, tentatives: 0, erreur: "resend_non_configure" };
    }

    const modele = genererEmailInstructionsAcompte(details);
    const pauses = options.pauses ?? PAUSES_PAR_DEFAUT;
    let derniere = "erreur_inconnue";
    let tentatives = 0;

    for (let tentative = 1; tentative <= pauses.length + 1; tentative++) {
      tentatives = tentative;
      let passagere: boolean;
      try {
        const reponse = await this.resend.emails.send(
          {
            from: config.emailFrom,
            to: destinataire,
            subject: modele.sujet,
            html: modele.html,
            text: modele.texte,
          },
          { idempotencyKey: options.cleIdempotence },
        );

        if (!reponse.error) {
          this.logger.log(
            `Instructions d'acompte de ${details.reference} envoyées à ${destinataire} ` +
              `(id: ${reponse.data?.id}, tentative ${tentative})`,
          );
          return { envoye: true, tentatives: tentative };
        }

        derniere = `${reponse.error.name}: ${reponse.error.message}`;
        passagere = ERREURS_PASSAGERES.has(reponse.error.name);
      } catch (erreur) {
        // Une exception est une panne réseau ou du client : on ne sait pas si
        // le message est parti, et c'est justement le cas que la clé
        // d'idempotence rend sûr à rejouer.
        derniere = (erreur as Error)?.message ?? "erreur_inconnue";
        passagere = true;
      }

      this.logger.warn(
        `Instructions d'acompte de ${details.reference}, tentative ${tentative} échouée : ${derniere}`,
      );
      if (!passagere || tentative > pauses.length) break;
      await new Promise((reprendre) => setTimeout(reprendre, pauses[tentative - 1]));
    }

    this.logger.error(
      `Instructions d'acompte de ${details.reference} non parties vers ${destinataire} : ${derniere}`,
    );
    return { envoye: false, tentatives, erreur: derniere };
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
