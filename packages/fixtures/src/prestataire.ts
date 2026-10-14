import type { Logement, StatutDemande, Vehicule } from "@teranga/contracts";
import { LOGEMENTS } from "./logements";
import { PARTENAIRES } from "./partenaires";
import { VEHICULES } from "./vehicules";

/**
 * L'espace prestataire, côté données.
 *
 * Décision du 11 octobre : l'espace avec compte fait partie de la V1, alors que
 * le PRD le reportait. La page de réponse par jeton reste en place comme repli,
 * et comme seul canal viable pour les taxis.
 */
export type StatutOffre = "brouillon" | "en-validation" | "publiee" | "suspendue";

export interface Periode {
  debut: string;
  fin: string;
}

export interface OffreDuPartenaire {
  id: string;
  logement: Logement;
  statut: StatutOffre;
  /** Ce qui manque pour que l'offre puisse être envoyée en validation (PAR-01). */
  manquant: string[];
  misAJourLe: string;
  /** Périodes libres déclarées par le partenaire (colonne « disponibilite »). */
  disponibilites: Periode[];
}

export interface DemandeRecue {
  id: string;
  reference: string;
  offreTitre: string;
  statut: StatutDemande;
  dates: { debut: string; fin: string };
  personnes: number;
  total: number;
  recueLe: string;
  expireLe?: string;
}

export interface ComptePrestataire {
  id: string;
  nom: string;
  telephone: string;
  verifieLe?: string;
  charteSigneeLe?: string;
}

/** Le compte de démonstration. Le code est le même que côté visiteur. */
export const COMPTE: ComptePrestataire = {
  id: PARTENAIRES.moussa.id,
  nom: "Moussa Faye",
  telephone: "+221 77 000 00 00",
  verifieLe: "2026-10-02",
  charteSigneeLe: "2026-10-02",
};

const JOUR = 24 * 60 * 60 * 1000;
const il_y_a = (heures: number) => new Date(Date.now() - heures * 3600_000).toISOString();

export const OFFRES: OffreDuPartenaire[] = [
  {
    id: "o-001",
    logement: LOGEMENTS.find((l) => l.id === "l-002")!,
    statut: "publiee",
    manquant: [],
    misAJourLe: il_y_a(50),
    disponibilites: [{ debut: "2026-10-20", fin: "2026-11-20" }],
  },
  {
    id: "o-002",
    logement: LOGEMENTS.find((l) => l.id === "l-007")!,
    statut: "en-validation",
    manquant: [],
    misAJourLe: il_y_a(8),
    disponibilites: [{ debut: "2026-10-25", fin: "2026-11-15" }],
  },
  {
    id: "o-003",
    logement: LOGEMENTS.find((l) => l.id === "l-005")!,
    statut: "brouillon",
    // Cinq photos au minimum, dont une principale (modèles d'envoi, PAR-01).
    manquant: ["photos", "disponibilite"],
    misAJourLe: il_y_a(2),
    disponibilites: [],
  },
];

/**
 * Les véhicules du partenaire sont tenus à part des logements : ce ne sont pas
 * les mêmes champs obligatoires, ni le même cycle d'édition. Les mêler dans une
 * seule liste aurait obligé chaque écran à deviner à quoi il a affaire.
 */
export interface OffreVehicule {
  id: string;
  vehicule: Vehicule;
  statut: StatutOffre;
  manquant: string[];
  misAJourLe: string;
}

export const OFFRES_VEHICULES: OffreVehicule[] = [
  {
    id: "ov-001",
    vehicule: VEHICULES.find((v) => v.id === "v-001")!,
    statut: "publiee",
    manquant: [],
    misAJourLe: il_y_a(60),
  },
  {
    id: "ov-002",
    vehicule: VEHICULES.find((v) => v.id === "v-005")!,
    statut: "en-validation",
    manquant: [],
    misAJourLe: il_y_a(5),
  },
];

export const DEMANDES_RECUES: DemandeRecue[] = [
  {
    id: "d-002",
    reference: "TW-480198",
    offreTitre: "Villa avec piscine, Ngor",
    statut: "envoyee",
    dates: { debut: new Date(Date.now() + 20 * JOUR).toISOString(), fin: new Date(Date.now() + 34 * JOUR).toISOString() },
    personnes: 2,
    total: 2225000,
    recueLe: il_y_a(1),
    expireLe: new Date(Date.now() + 90 * 60000).toISOString(),
  },
  {
    id: "d-001",
    reference: "TW-480213",
    offreTitre: "Résidence Almadies",
    statut: "acceptee",
    dates: { debut: new Date(Date.now() + 20 * JOUR).toISOString(), fin: new Date(Date.now() + 25 * JOUR).toISOString() },
    personnes: 2,
    total: 475000,
    recueLe: il_y_a(3),
  },
  {
    id: "d-006",
    reference: "TW-476003",
    offreTitre: "Appartement calme, Point E",
    statut: "terminee",
    dates: { debut: il_y_a(400), fin: il_y_a(250) },
    personnes: 3,
    total: 408000,
    recueLe: il_y_a(400),
  },
];

/** Nombre minimal de photos avant envoi en validation (modèles d'envoi, PAR-01). */
export const PHOTOS_MINIMUM = 5;

/** Le code de démonstration pour la connexion prestataire. */
export const CODE_PRESTATAIRE = "123456";
