import type { Demande } from "@teranga/contracts";

export interface EntreeCreationLogement {
  logementId: string;
  debut: string;
  fin: string;
  personnes: number;
  heureArrivee?: string;
  message?: string;
  visiteurId: string;
}

export interface EntreeCreationVehicule {
  vehiculeId: string;
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee?: string;
  quand: string;
  passagers: number;
  bagages: number;
  vol?: string;
  message?: string;
  visiteurId: string;
}

/**
 * Port des demandes.
 *
 * La création résout l'offre et fige le prix : c'est le dépôt qui lit le
 * catalogue (fixtures aujourd'hui, SQL demain), pas le service.
 */
export interface DepotDemandes {
  listerPourVisiteur(visiteurId: string): Promise<Demande[]>;
  parId(id: string): Promise<Demande | null>;
  creerLogement(entree: EntreeCreationLogement): Promise<Demande>;
  creerVehicule(entree: EntreeCreationVehicule): Promise<Demande>;
  enregistrer(demande: Demande): Promise<Demande>;
  visiteurDe?(demandeId: string): Promise<string | null> | string | undefined;
}
