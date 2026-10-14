import type { CategorieVehicule, MoyenDePaiement, OffreTransport } from "../enums";
import type { Partenaire, Photo } from "./logement";

export interface Chauffeur {
  nomAffiche: string;
  languesParlees: string[];
  photo?: Photo;
}

/** Comme pour le logement : pas d'immatriculation ni de téléphone avant confirmation. */
export interface Vehicule {
  id: string;
  slug: string;
  offresProposees: OffreTransport[];
  categorie: CategorieVehicule;
  marque: string;
  modele: string;
  annee: number;
  placesPassagers: number;
  bagages: number;
  climatisation: boolean;
  zonesCouvertes: string[];
  chauffeur?: Chauffeur;
  prixParJour?: number;
  prixParTrajet?: number;
  kilometrageInclus?: number;
  carburantALaCharge?: "client" | "partenaire";
  lieuDeRemise?: string;
  moyensDePaiement: MoyenDePaiement[];
  photos: Photo[];
  partenaire: Partenaire;
  verifie: true;
}

export interface CoordonneesVehicule {
  immatriculation: string;
  telephoneChauffeur: string;
  lieuDeRendezVous?: string;
}
