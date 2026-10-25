import { HttpStatus } from "@nestjs/common";

import { ErreurMetier } from "../../commun/erreurs";

/**
 * Refus de confirmer une réservation dont l'acompte n'est pas payé et vérifié.
 *
 * Un seul message, deux endroits : le service des acomptes (contrôle rapide, avant
 * toute écriture) et l'écriture de la confirmation elle-même, sous verrou (voir
 * `DepotDemandesPrisma.enregistrer`). Le visiteur lit la même phrase dans les deux cas.
 */
export function acompteNonPaye(): ErreurMetier {
  return new ErreurMetier(
    "ACOMPTE_NON_PAYE",
    "Un acompte a été demandé pour cette demande : la réservation ne peut être confirmée " +
      "qu'une fois sa réception vérifiée par notre équipe.",
    HttpStatus.CONFLICT,
  );
}
