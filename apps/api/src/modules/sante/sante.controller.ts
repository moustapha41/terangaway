import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { config } from "../../config/configuration";

/**
 * Supervision.
 *
 * `/sante` doit répondre sans toucher à aucune dépendance : c'est ce qui permet
 * de distinguer « l'API est morte » de « la base est morte ».
 *
 * `/sante/posture` répond à une question qu'on s'est posée trop tard : quelles
 * valeurs l'API applique-t-elle *réellement* dans ce conteneur ? L'audit de
 * production a dû déduire `NODE_ENV` du comportement du site, faute de pouvoir
 * le lire. Trois booléens et un nom d'environnement suffisent à trancher.
 *
 * Aucun secret n'y figure : jamais une clé, une URL de base ni une empreinte,
 * seulement la *présence* d'un secret. « OTP_SECRET est défini » est une
 * information d'exploitation ; sa valeur serait une fuite.
 */
@ApiTags("sante")
@Controller("sante")
export class ControleurSante {
  private readonly demarreA = Date.now();

  @Get()
  @ApiOperation({ summary: "L'API répond-elle ?" })
  etat() {
    return {
      etat: "ok",
      depuisSecondes: Math.round((Date.now() - this.demarreA) / 1000),
    };
  }

  @Get("posture")
  @ApiOperation({
    summary: "Configuration de sécurité effective (sans aucun secret)",
  })
  posture() {
    return {
      environnement: config.environnement,
      estProduction: config.estProduction,
      /** Le point qui compte : les raccourcis de démonstration sont-ils ouverts ? */
      comptesDemoAutorises: config.autoriserComptesDemo,
      /** Quelqu'un a réclamé le mode démo et la production l'a refusé. */
      demoRefuseeEnProduction: config.demoRefuseeEnProduction,
      secrets: {
        resendApiKey: config.resendApiKey ? "defini" : "absent",
        otpSecret: config.otpSecret ? "defini" : "absent",
        nombreClesOtp: config.otpSecretsPourVerification.length,
      },
      appUrl: config.appUrl,
      originesAutorisees: config.originesAutorisees,
    };
  }
}
