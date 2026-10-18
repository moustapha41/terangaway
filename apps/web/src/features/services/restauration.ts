export type MomentPlat = "midi" | "soir" | "rue" | "boisson";

export interface Plat {
  /** Préfixe des clés : `restauration.plat.<cle>Nom`, `…Texte`. */
  cle: string;
  moment: MomentPlat;
  /** Inscrit au patrimoine culturel immatériel de l'humanité, et l'année. */
  unesco?: number;
}

/**
 * Ce qu'on mange au Sénégal, rangé par moment de la journée.
 *
 * Les noms wolof sont donnés tels qu'on les lit sur les ardoises — « ceebu
 * jën » dans l'orthographe officielle, « thiéboudiène » dans la transcription
 * française, les deux ont cours. Le catalogue de langues porte les deux
 * graphies, c'est ainsi qu'un visiteur reconnaîtra le plat qu'on lui sert.
 */
export const PLATS: readonly Plat[] = [
  { cle: "ceebuJen", moment: "midi", unesco: 2021 },
  { cle: "yassa", moment: "midi" },
  { cle: "mafe", moment: "midi" },
  { cle: "soupouKandia", moment: "midi" },
  { cle: "thiou", moment: "midi" },
  { cle: "dibi", moment: "soir" },
  { cle: "chawarma", moment: "soir" },
  { cle: "pastels", moment: "rue" },
  { cle: "accara", moment: "rue" },
  { cle: "lakh", moment: "rue" },
  { cle: "bissap", moment: "boisson" },
  { cle: "cafeTouba", moment: "boisson" },
  { cle: "ataya", moment: "boisson" },
];

export const MOMENTS_PLAT: readonly MomentPlat[] = ["midi", "soir", "rue", "boisson"];

export interface QuartierTable {
  cle: string;
  latitude: number;
  longitude: number;
}

/**
 * Où l'on mange, de la presqu'île à la petite côte.
 *
 * Aucun établissement n'est nommé : un restaurant ferme, change de chef ou de
 * quartier, et une liste de noms vieillit mal sur une page qu'on ne relit pas.
 * Les quartiers, eux, gardent leur caractère — et c'est l'équipe qui, à la
 * demande, cherche la table du jour.
 */
export const QUARTIERS_TABLE: readonly QuartierTable[] = [
  { cle: "plateau", latitude: 14.6682, longitude: -17.4362 },
  { cle: "almadies", latitude: 14.7442, longitude: -17.5204 },
  { cle: "ngor", latitude: 14.7519, longitude: -17.5133 },
  { cle: "pointE", latitude: 14.6936, longitude: -17.4664 },
  { cle: "medina", latitude: 14.6794, longitude: -17.4489 },
  { cle: "yoff", latitude: 14.7556, longitude: -17.4664 },
  { cle: "diamniadio", latitude: 14.7281, longitude: -17.1844 },
  { cle: "saly", latitude: 14.4461, longitude: -17.0083 },
];

export interface ApplicationLivraison {
  cle: string;
  /** Le nom commercial ne se traduit pas. */
  nom: string;
  domaine: string;
}

/**
 * Les applications de livraison de repas qui desservent Dakar.
 *
 * **Vérifié en octobre 2026, à revoir au moins une fois par an.** Ce marché
 * bouge vite : Jumia Food a quitté le Sénégal fin 2022 puis fermé partout fin
 * 2023, et des pages de conseils continuent de le recommander. Deux règles
 * tenues ici : ne nommer que des services dont on a vu la page vivante, et
 * dire au visiteur de vérifier la couverture de son quartier dans
 * l'application plutôt que de la promettre à sa place.
 */
export const APPLICATIONS_LIVRAISON: readonly ApplicationLivraison[] = [
  { cle: "tiakTiak", nom: "Tiak-Tiak", domaine: "tiak-tiak.sn" },
  { cle: "seneat", nom: "SenEat", domaine: "seneat.com" },
  { cle: "dakarFood", nom: "Dakar Food Delivery", domaine: "dakarfooddelivery.com" },
  { cle: "livreurbi", nom: "LivreurBI", domaine: "livreurbi.com" },
  { cle: "togalma", nom: "Togalma", domaine: "togalma.com" },
];

/** Les usages de table : ce qui surprend, et ce qu'il faut savoir. */
export const USAGES_TABLE = [
  "bol",
  "horaires",
  "teranga",
  "ramadan",
  "regimes",
  "eau",
] as const;

/** Ordres de grandeur, pour situer un budget. */
export const REPERES_PRIX = ["gargote", "quartier", "bordDeMer"] as const;
