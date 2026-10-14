import type { Equipement, TypeLogement } from "../enums";
import type { Logement } from "./logement";
import type { Vehicule } from "./vehicule";

export interface CriteresLogement {
  ville: string;
  debut: string;
  fin: string;
  personnes: number;
  types?: TypeLogement[];
  equipements?: Equipement[];
  quartiers?: string[];
  prixMin?: number;
  prixMax?: number;
  capaciteMin?: number;
  tri?: "pertinence" | "prix-croissant" | "prix-decroissant" | "capacite" | "note";
}

/**
 * Les compteurs affichés à côté de chaque filtre.
 *
 * Ils sont calculés sur le catalogue entier, pas sur les résultats courants :
 * un filtre qui afficherait « (0) » partout dès qu'on en coche un autre ne
 * servirait plus à rien.
 */
export interface Facettes {
  total: number;
  types: Record<string, number>;
  quartiers: Record<string, number>;
  equipements: Record<string, number>;
  prix: { min: number; max: number };
}

/** Une page de résultats. `total` sert à la phrase « 24 logements disponibles ». */
export interface Resultats<T> {
  elements: T[];
  total: number;
  page: number;
  parPage: number;
}

export type ResultatsLogements = Resultats<Logement> & { facettes: Facettes };
export type ResultatsVehicules = Resultats<Vehicule>;
