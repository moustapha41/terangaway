import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { CompteAdministrateur, CoordonneesAdmin, SaisieCoordonneesAdmin } from "@teranga/contracts";

import { DEPOT_COORDONNEES } from "../../commun/depots/depot";
import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { STATUTS_SAISIE_COORDONNEES } from "../demandes/coordonnees";
import type { DepotCoordonnees, LigneCoordonnees } from "./coordonnees.depot";
import { validerCoordonnees } from "./coordonnees.validation";

/**
 * Les coordonnées d'une réservation, côté équipe : consulter, saisir, vérifier.
 *
 * Deux personnes, toujours : celle qui saisit ne vérifie pas. Une saisie
 * nouvelle annule la vérification précédente — ce qui a été relu, c'est
 * l'ancienne valeur. Et la vérification porte sur **la** saisie que le
 * vérificateur a eue sous les yeux : si une autre est arrivée entre-temps, il
 * n'a pas relu celle-là.
 *
 * Aucun message d'erreur ne cite une coordonnée.
 */
@Injectable()
export class ServiceCoordonnees {
  constructor(@Inject(DEPOT_COORDONNEES) private readonly depot: DepotCoordonnees) {}

  async lire(demandeId: string, acteur: CompteAdministrateur): Promise<CoordonneesAdmin> {
    return vueAdmin(await this.ligne(demandeId), acteur);
  }

  async saisir(
    demandeId: string,
    saisie: SaisieCoordonneesAdmin,
    acteur: CompteAdministrateur,
  ): Promise<CoordonneesAdmin> {
    const ligne = await this.ligne(demandeId);
    exigerStatutSaisissable(ligne);
    if (!ligne.famille) throw familleNonPriseEnCharge();

    const coordonnees = validerCoordonnees(ligne.famille, saisie);
    const apres = await this.depot.saisir(demandeId, {
      coordonnees,
      parId: acteur.id,
      le: new Date(),
      statutLu: ligne.statut,
    });
    return vueAdmin(apres, acteur);
  }

  /**
   * `saisieLe` est la date de la saisie affichée au vérificateur : elle sert
   * de version. Une saisie plus récente rend la vérification caduque.
   */
  async verifier(
    demandeId: string,
    saisieLe: string,
    acteur: CompteAdministrateur,
  ): Promise<CoordonneesAdmin> {
    const ligne = await this.ligne(demandeId);
    exigerStatutSaisissable(ligne);
    if (!ligne.famille) throw familleNonPriseEnCharge();

    if (!ligne.coordonnees) {
      throw new ErreurMetier(
        "COORDONNEES_ABSENTES",
        "Il n'y a pas de coordonnées à vérifier.",
        HttpStatus.CONFLICT,
      );
    }
    // Des coordonnées qui ne passeraient plus la validation — saisies avant
    // elle, ou d'une autre famille — ne se vérifient pas : on ne signe pas ce
    // qu'on ne pourrait pas enregistrer aujourd'hui.
    try {
      validerCoordonnees(ligne.famille, ligne.coordonnees as unknown as Record<string, unknown>);
    } catch {
      throw new ErreurMetier(
        "COORDONNEES_A_RESAISIR",
        "Les coordonnées enregistrées ne sont pas valides : elles doivent être ressaisies avant vérification.",
        HttpStatus.CONFLICT,
      );
    }
    if (!ligne.saisie) {
      throw new ErreurMetier(
        "COORDONNEES_SAISIE_NON_TRACEE",
        "On ne sait pas qui a saisi ces coordonnées : elles doivent être ressaisies avant vérification.",
        HttpStatus.CONFLICT,
      );
    }
    if (ligne.saisie.par.id === acteur.id) {
      throw new ErreurMetier(
        "COORDONNEES_QUATRE_YEUX",
        "Vous avez saisi ces coordonnées : une autre personne de l'équipe doit les vérifier.",
        HttpStatus.FORBIDDEN,
      );
    }
    if (ligne.verification) {
      throw new ErreurMetier(
        "COORDONNEES_DEJA_VERIFIEES",
        "Ces coordonnées sont déjà vérifiées.",
        HttpStatus.CONFLICT,
      );
    }
    if (ligne.saisie.le !== saisieLe) throw versionDepassee();

    const apres = await this.depot.verifier(demandeId, {
      parId: acteur.id,
      le: new Date(),
      statutLu: ligne.statut,
      saisieLe,
    });
    return vueAdmin(apres, acteur);
  }

  private async ligne(demandeId: string): Promise<LigneCoordonnees> {
    const ligne = await this.depot.lire(demandeId);
    if (!ligne) throw introuvable("Demande");
    return ligne;
  }
}

function saisissable(ligne: LigneCoordonnees): boolean {
  return STATUTS_SAISIE_COORDONNEES.includes(ligne.statut);
}

function exigerStatutSaisissable(ligne: LigneCoordonnees): void {
  if (!saisissable(ligne)) {
    throw new ErreurMetier(
      "COORDONNEES_STATUT_NON_ELIGIBLE",
      `Les coordonnées ne se saisissent pas sur une demande « ${ligne.statut} » : il faut qu'elle soit acceptée ou confirmée.`,
      HttpStatus.CONFLICT,
    );
  }
}

function familleNonPriseEnCharge(): ErreurMetier {
  return new ErreurMetier(
    "COORDONNEES_GENRE_NON_PRIS_EN_CHARGE",
    "Aucune forme de coordonnées n'est prévue pour un service à la demande.",
    HttpStatus.CONFLICT,
  );
}

function versionDepassee(): ErreurMetier {
  return new ErreurMetier(
    "COORDONNEES_CONFLIT",
    "Les coordonnées ont été ressaisies depuis votre lecture : rechargez la fiche avant de vérifier.",
    HttpStatus.CONFLICT,
  );
}

function vueAdmin(ligne: LigneCoordonnees, acteur: CompteAdministrateur): CoordonneesAdmin {
  const etat = !ligne.coordonnees ? "absentes" : ligne.verification ? "verifiees" : "saisies";
  return {
    demandeId: ligne.demandeId,
    statut: ligne.statut,
    famille: ligne.famille,
    etat,
    coordonnees: ligne.coordonnees,
    saisie: ligne.saisie,
    verification: ligne.verification,
    saisissable: saisissable(ligne) && ligne.famille !== undefined,
    peutVerifier:
      etat === "saisies" &&
      saisissable(ligne) &&
      ligne.saisie !== undefined &&
      ligne.saisie.par.id !== acteur.id,
  };
}
