import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { config, type ConfigAcompte } from "../../config/configuration";
import { DELAIS_ACOMPTE_HEURES } from "../acomptes/calcul";

/**
 * Ce qu'on peut dire de l'acompte sans livrer le compte bancaire.
 *
 * Le taux en fait partie : il figure en clair dans chaque e-mail
 * d'instructions, le cacher ici ne protégerait rien et empêcherait de vérifier
 * qu'on applique bien celui qu'on croit. L'IBAN, le BIC et le titulaire n'y
 * sont **jamais** — seulement l'état de leur renseignement, exactement comme
 * les secrets voisins ne disent que « defini » ou « absent ».
 *
 * Fonction séparée, et exportée, pour qu'elle se teste sans fabriquer un
 * environnement complet : c'est elle qui porte la garantie de non-fuite.
 */
export function postureAcompte(acompte: ConfigAcompte) {
  return {
    /** L'acompte peut-il réellement être réclamé ? Les trois verrous sont-ils ouverts ? */
    actif: acompte.actif,
    /** Le taux appliqué, en pourcents. `null` quand il n'est pas configuré. */
    pourcentage: acompte.pourcentage ?? null,
    /**
     * Le délai de paiement accordé après acceptation, **par genre**, en heures.
     * `null` = ce genre ne donne pas lieu à un acompte.
     *
     * Toute la table, et pas seulement les genres éligibles : voir « taxi :
     * null » répond à la question qu'on se pose en exploitation, là où un genre
     * absent de la liste laisserait croire à un oubli.
     */
    delaisHeures: { ...DELAIS_ACOMPTE_HEURES },
    /** « defini » | « incomplet » | « absent ». Jamais l'IBAN. */
    coordonneesBancaires: acompte.etatCoordonnees,
  };
}

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
      acompte: postureAcompte(config.acompte),
      appUrl: config.appUrl,
      originesAutorisees: config.originesAutorisees,
    };
  }
}
