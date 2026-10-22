import { HttpStatus } from "@nestjs/common";
import type {
  CoordonneesLogement,
  CoordonneesVehicule,
  FamilleCoordonnees,
  StatutDemande,
  TraceCoordonnees,
} from "@teranga/contracts";

import { ErreurMetier } from "../../commun/erreurs";

/** Ce que le dépôt sait d'une demande, côté coordonnées — sans filtre. */
export interface LigneCoordonnees {
  demandeId: string;
  statut: StatutDemande;
  famille?: FamilleCoordonnees;
  coordonnees?: CoordonneesLogement | CoordonneesVehicule;
  saisie?: TraceCoordonnees;
  verification?: TraceCoordonnees;
}

/**
 * Port des coordonnées d'une réservation.
 *
 * Réservé au backoffice : c'est la seule lecture **non filtrée** des
 * coordonnées, et elle ne doit jamais servir à une réponse visiteur ou
 * partenaire. Les écritures sont conditionnelles — elles n'aboutissent que si
 * la demande est encore dans l'état sur lequel la décision a été prise — et
 * lèvent `COORDONNEES_CONFLIT` sinon, sans rien écrire.
 */
export interface DepotCoordonnees {
  lire(demandeId: string): Promise<LigneCoordonnees | null>;
  /**
   * Écrit les coordonnées, la trace de saisie, et **efface** la vérification
   * précédente, en une seule écriture. Condition : statut toujours `statutLu`.
   */
  saisir(
    demandeId: string,
    entree: {
      coordonnees: CoordonneesLogement | CoordonneesVehicule;
      parId: string;
      le: Date;
      statutLu: StatutDemande;
    },
  ): Promise<LigneCoordonnees>;
  /**
   * Pose la vérification de la saisie datée `saisieLe` — celle que le
   * vérificateur a eue sous les yeux. Conditions : statut toujours `statutLu`,
   * saisie inchangée, coordonnées présentes, pas encore vérifiée, et
   * vérificateur différent du saisissant.
   */
  verifier(
    demandeId: string,
    entree: { parId: string; le: Date; statutLu: StatutDemande; saisieLe: string },
  ): Promise<LigneCoordonnees>;
}

/** La demande a bougé entre la lecture et l'écriture : rien n'a été écrit. */
export function conflitCoordonnees(): ErreurMetier {
  return new ErreurMetier(
    "COORDONNEES_CONFLIT",
    "La demande ou ses coordonnées ont changé entre-temps : rien n'a été enregistré. Rechargez la fiche.",
    HttpStatus.CONFLICT,
  );
}
