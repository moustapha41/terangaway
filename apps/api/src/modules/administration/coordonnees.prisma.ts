import { HttpStatus, Injectable } from "@nestjs/common";

import { ErreurMetier } from "../../commun/erreurs";
import type { DepotCoordonnees, LigneCoordonnees } from "./coordonnees.depot";

/**
 * Les coordonnées en base — **en attente de migration**.
 *
 * La saisie et la vérification exigent quatre colonnes de traçabilité
 * (`coordonneesSaisiesLe`, `coordonneesSaisiesParId`, `coordonneesVerifieesLe`,
 * `coordonneesVerifieesParId`) qui n'existent pas encore : la migration est
 * proposée, pas appliquée. Les écrire ici sans elles reviendrait à saisir des
 * coordonnées que personne ne pourrait attribuer, ni donc vérifier à quatre
 * yeux.
 *
 * Chaque opération le dit donc, explicitement, plutôt que de faire semblant.
 * Le jour de la migration, cette classe reçoit son implémentation — lecture
 * jointe aux comptes, écritures conditionnelles en `updateMany` — et rien
 * d'autre ne change : le service, les routes et l'écran passent déjà par le
 * port.
 */
@Injectable()
export class DepotCoordonneesPrisma implements DepotCoordonnees {
  lire(): Promise<LigneCoordonnees | null> {
    return Promise.reject(enAttente());
  }

  saisir(): Promise<LigneCoordonnees> {
    return Promise.reject(enAttente());
  }

  verifier(): Promise<LigneCoordonnees> {
    return Promise.reject(enAttente());
  }
}

function enAttente(): ErreurMetier {
  return new ErreurMetier(
    "COORDONNEES_MIGRATION_EN_ATTENTE",
    "La gestion des coordonnées attend la migration de la base qui enregistre qui les saisit et qui les vérifie.",
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
