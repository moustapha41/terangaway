/**
 * Les valeurs fermées du domaine. Elles viennent du PRD §11 et des modèles
 * d'envoi aux partenaires : ce sont exactement les colonnes des tableurs, donc
 * le formulaire en ligne, la fiche et l'import parlent le même langage.
 */

export const TYPES_LOGEMENT = ["villa", "appartement", "studio", "chambre", "residence"] as const;
export type TypeLogement = (typeof TYPES_LOGEMENT)[number];

export const EQUIPEMENTS = [
  "climatisation",
  "wifi",
  "eau-chaude",
  "cuisine",
  "groupe-electrogene",
  "parking",
  "gardien",
  "piscine",
  // Ajoutés d'après la maquette du parcours logement. Les modèles d'envoi aux
  // partenaires ont été mis à jour en conséquence : les colonnes du tableur et
  // les cases du formulaire doivent rester la même liste.
  "tv",
  "lave-linge",
  "balcon-terrasse",
] as const;
export type Equipement = (typeof EQUIPEMENTS)[number];

export const INCLUS = ["eau", "electricite", "menage", "petit-dejeuner"] as const;
export type Inclus = (typeof INCLUS)[number];

export const CATEGORIES_VEHICULE = ["berline", "suv", "minibus", "taxi"] as const;
export type CategorieVehicule = (typeof CATEGORIES_VEHICULE)[number];

export const OFFRES_TRANSPORT = [
  "trajet-avec-chauffeur",
  "location-avec-chauffeur",
  "location-sans-chauffeur",
  "taxi",
] as const;
export type OffreTransport = (typeof OFFRES_TRANSPORT)[number];

export const MOYENS_DE_PAIEMENT = ["especes", "wave", "orange-money"] as const;
export type MoyenDePaiement = (typeof MOYENS_DE_PAIEMENT)[number];

/**
 * Les 7 statuts d'une demande. L'ordre compte : il est celui de la frise.
 * Le paiement n'en fait jamais partie — il a lieu sur place, hors plateforme.
 */
export const STATUTS_DEMANDE = [
  "envoyee",
  "acceptee",
  "confirmee",
  "terminee",
  "refusee",
  "expiree",
  "annulee",
] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];

/** Un statut terminal ne mène plus nulle part : aucune action n'est proposée. */
export const STATUTS_TERMINAUX: readonly StatutDemande[] = ["terminee", "refusee", "expiree", "annulee"];

export const MOTIFS_REFUS = ["plus-disponible", "dates-impossibles", "capacite", "autre"] as const;
export type MotifRefus = (typeof MOTIFS_REFUS)[number];

/**
 * Services sans catalogue : le visiteur décrit son besoin, l'équipe oriente
 * vers un partenaire. Pas de fiche produit, pas de prix figé à l'envoi.
 */
export const SERVICES_A_LA_DEMANDE = [
  "guides",
  "restauration",
  "assistance",
  "decouverte",
  "internet",
] as const;
export type ServiceALaDemande = (typeof SERVICES_A_LA_DEMANDE)[number];
