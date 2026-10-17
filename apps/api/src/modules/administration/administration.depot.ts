import type {
  DemandeAdmin,
  FiltresDemandesAdmin,
  PageDemandesAdmin,
  TableauDeBordAdmin,
} from "@teranga/contracts";

/** Ce que l'équipe écrit sur une demande, hors changement de statut. */
export interface AnnotationAdmin {
  noteInterne?: string;
  prixPropose?: number | null;
  prestataireId?: string | null;
}

/**
 * Port du backoffice.
 *
 * Il ne refait pas le cycle de vie : les changements de statut passent par
 * `ServiceDemandes`, qui porte la table des transitions. Ici vivent la
 * lecture — liste filtrée, fiche complète, compteurs — et ce que l'équipe
 * ajoute à la main.
 */
export interface DepotAdministration {
  lister(filtres: FiltresDemandesAdmin): Promise<PageDemandesAdmin>;
  parId(id: string): Promise<DemandeAdmin | null>;
  annoter(id: string, annotation: AnnotationAdmin): Promise<DemandeAdmin>;
  tableauDeBord(): Promise<TableauDeBordAdmin>;
  /** Toutes les demandes correspondant aux filtres, sans pagination : l'export. */
  exporter(filtres: FiltresDemandesAdmin): Promise<DemandeAdmin[]>;
}

export const DEPOT_ADMINISTRATION = Symbol("DepotAdministration");
