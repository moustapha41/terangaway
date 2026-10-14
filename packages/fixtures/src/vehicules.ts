import type { Vehicule } from "@teranga/contracts";
import { PARTENAIRES } from "./partenaires";

/**
 * Le parc de véhicules.
 *
 * Dix voitures réelles, reconnues sur les photos envoyées par leurs
 * propriétaires : marque, modèle, couleur et état viennent des images, rien
 * d'autre n'accompagnait les clichés.
 *
 * Deux règles tenues ici plutôt qu'à l'écran :
 *
 * - ni immatriculation ni téléphone du chauffeur : ces champs n'existent pas
 *   dans `Vehicule`, ils arrivent avec la confirmation. Les plaques lisibles
 *   sur les photos ont donc été floutées, sans quoi la règle serait tenue par
 *   le type et trahie par l'image ;
 * - pas de `chauffeur` nommé : aucun nom n'a été communiqué, et un prénom
 *   inventé vaudrait moins qu'un champ vide.
 *
 * Les prix suivent un barème par catégorie, à relire avant toute mise en
 * ligne réelle : les propriétaires n'en ont annoncé aucun.
 */

/** Même raison que pour les logements : la plateforme répond des offres
 * qu'elle a collectées tant que chaque propriétaire n'a pas son compte. */
const COLLECTE = PARTENAIRES.terangaWay;

/** Le parc dessert l'agglomération et la Petite Côte, aéroport compris. */
const ZONES = ["Dakar", "Aéroport AIBD", "Diamniadio", "Saly"];

/** Le paiement a lieu sur place, hors plateforme (§B.2). */
const PAIEMENTS = ["especes", "wave", "orange-money"] as const;

export const VEHICULES: Vehicule[] = [
  {
    id: "v-001",
    slug: "ford-fusion-blanche",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "berline",
    marque: "Ford",
    modele: "Fusion blanche",
    annee: 2017,
    placesPassagers: 4,
    bagages: 2,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 25000,
    prixParJour: 38000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/ford-fusion-blanche/01.jpg", alt: "Berline Ford Fusion blanche vue de trois quarts avant", principale: true },
      { url: "/images/vehicules/ford-fusion-blanche/02.jpg", alt: "Arrière de la berline blanche, vue de trois quarts" },
      { url: "/images/vehicules/ford-fusion-blanche/03.jpg", alt: "Sièges avant en cuir beige sous le toit ouvrant" },
      { url: "/images/vehicules/ford-fusion-blanche/04.jpg", alt: "Banquette arrière en cuir beige" },
      { url: "/images/vehicules/ford-fusion-blanche/05.jpg", alt: "Profil de la berline blanche" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-002",
    slug: "hyundai-santa-fe-blanc",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Hyundai",
    modele: "Santa Fe blanc",
    annee: 2017,
    placesPassagers: 5,
    bagages: 3,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 45000,
    prixParJour: 65000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/hyundai-santa-fe-blanc/01.jpg", alt: "SUV Hyundai Santa Fe blanc vu de face", principale: true },
      { url: "/images/vehicules/hyundai-santa-fe-blanc/02.jpg", alt: "Profil du SUV blanc stationné sous les arbres" },
      { url: "/images/vehicules/hyundai-santa-fe-blanc/03.jpg", alt: "Tableau de bord et volant du SUV" },
      { url: "/images/vehicules/hyundai-santa-fe-blanc/04.jpg", alt: "Places arrière vues depuis la portière ouverte" },
      { url: "/images/vehicules/hyundai-santa-fe-blanc/05.jpg", alt: "Poste de conduite vu depuis la portière" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-003",
    slug: "hyundai-sonata-grise",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "berline",
    marque: "Hyundai",
    modele: "Sonata grise",
    annee: 2016,
    placesPassagers: 4,
    bagages: 2,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 25000,
    prixParJour: 38000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/hyundai-sonata-grise/01.jpg", alt: "Berline Hyundai Sonata grise vue de trois quarts avant", principale: true },
      { url: "/images/vehicules/hyundai-sonata-grise/02.jpg", alt: "Face avant de la berline grise" },
      { url: "/images/vehicules/hyundai-sonata-grise/03.jpg", alt: "Console centrale avec écran de recul et boîte automatique" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-004",
    slug: "ford-edge-sport-noir",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Ford",
    modele: "Edge Sport noir",
    annee: 2017,
    placesPassagers: 5,
    bagages: 3,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 45000,
    prixParJour: 65000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/ford-edge-sport-noir/01.jpg", alt: "SUV Ford Edge noir vu de profil", principale: true },
      { url: "/images/vehicules/ford-edge-sport-noir/02.jpg", alt: "Arrière du SUV noir, hayon et feux" },
      { url: "/images/vehicules/ford-edge-sport-noir/03.jpg", alt: "Places arrière sous le toit ouvrant panoramique" },
      { url: "/images/vehicules/ford-edge-sport-noir/04.jpg", alt: "Banquette arrière du SUV" },
      { url: "/images/vehicules/ford-edge-sport-noir/05.jpg", alt: "Poste de conduite avec écran tactile et boîte automatique" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-005",
    slug: "mazda-cx5-blanc",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Mazda",
    modele: "CX-5 blanc",
    annee: 2016,
    placesPassagers: 5,
    bagages: 3,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 45000,
    prixParJour: 65000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/mazda-cx5-blanc/01.jpg", alt: "SUV Mazda CX-5 blanc vu de trois quarts arrière", principale: true },
      { url: "/images/vehicules/mazda-cx5-blanc/02.jpg", alt: "SUV blanc vu de trois quarts avant" },
      { url: "/images/vehicules/mazda-cx5-blanc/03.jpg", alt: "Tableau de bord et toit ouvrant du SUV blanc" },
      { url: "/images/vehicules/mazda-cx5-blanc/04.jpg", alt: "Face avant du SUV blanc" },
      { url: "/images/vehicules/mazda-cx5-blanc/05.jpg", alt: "Sièges avant vus depuis la portière ouverte" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-006",
    slug: "mazda-cx5-noir",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Mazda",
    modele: "CX-5 noir",
    annee: 2019,
    placesPassagers: 5,
    bagages: 3,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 45000,
    prixParJour: 65000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/mazda-cx5-noir/01.jpg", alt: "SUV Mazda CX-5 noir vu de profil", principale: true },
      { url: "/images/vehicules/mazda-cx5-noir/02.jpg", alt: "SUV noir vu de trois quarts arrière" },
      { url: "/images/vehicules/mazda-cx5-noir/03.jpg", alt: "Face avant du SUV noir, feux allumés" },
      { url: "/images/vehicules/mazda-cx5-noir/04.jpg", alt: "Poste de conduite du SUV noir" },
      { url: "/images/vehicules/mazda-cx5-noir/05.jpg", alt: "Places arrière et coffre, portière ouverte" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-007",
    slug: "mazda-cx5-rouge",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Mazda",
    modele: "CX-5 rouge",
    annee: 2016,
    placesPassagers: 5,
    bagages: 3,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 45000,
    prixParJour: 65000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/mazda-cx5-rouge/01.jpg", alt: "SUV Mazda CX-5 rouge vu de profil", principale: true },
      { url: "/images/vehicules/mazda-cx5-rouge/02.jpg", alt: "SUV rouge vu de trois quarts avant" },
      { url: "/images/vehicules/mazda-cx5-rouge/03.jpg", alt: "SUV rouge, portières ouvertes" },
      { url: "/images/vehicules/mazda-cx5-rouge/04.jpg", alt: "Places arrière et coffre du SUV rouge" },
      { url: "/images/vehicules/mazda-cx5-rouge/05.jpg", alt: "Arrière du SUV rouge" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-008",
    slug: "kia-sportage-noir",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Kia",
    modele: "Sportage noir",
    annee: 2019,
    placesPassagers: 5,
    bagages: 3,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 45000,
    prixParJour: 65000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/kia-sportage-noir/01.jpg", alt: "SUV Kia Sportage noir vu de trois quarts avant", principale: true },
      { url: "/images/vehicules/kia-sportage-noir/02.jpg", alt: "SUV noir vu de trois quarts arrière" },
      { url: "/images/vehicules/kia-sportage-noir/03.jpg", alt: "Sièges avant et console centrale" },
      { url: "/images/vehicules/kia-sportage-noir/04.jpg", alt: "Banquette arrière du SUV" },
      { url: "/images/vehicules/kia-sportage-noir/05.jpg", alt: "Tableau de bord et volant" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-009",
    slug: "toyota-prado-cuir",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Toyota",
    modele: "Land Cruiser Prado — cuir fauve",
    annee: 2018,
    placesPassagers: 6,
    bagages: 4,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 60000,
    prixParJour: 90000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/toyota-prado-cuir/01.jpg", alt: "Toyota Land Cruiser Prado noir vu de trois quarts avant", principale: true },
      { url: "/images/vehicules/toyota-prado-cuir/02.jpg", alt: "Arrière du Prado avec sa roue de secours" },
      { url: "/images/vehicules/toyota-prado-cuir/03.jpg", alt: "Sièges avant en cuir fauve" },
      { url: "/images/vehicules/toyota-prado-cuir/04.jpg", alt: "Banquette arrière en cuir fauve" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
  {
    id: "v-010",
    slug: "toyota-prado-tissu",
    offresProposees: ["trajet-avec-chauffeur", "location-avec-chauffeur"],
    categorie: "suv",
    marque: "Toyota",
    modele: "Land Cruiser Prado — tissu gris",
    annee: 2018,
    placesPassagers: 6,
    bagages: 4,
    climatisation: true,
    zonesCouvertes: [...ZONES],
    prixParTrajet: 60000,
    prixParJour: 90000,
    moyensDePaiement: [...PAIEMENTS],
    photos: [
      { url: "/images/vehicules/toyota-prado-tissu/01.jpg", alt: "Face avant du Toyota Land Cruiser Prado noir", principale: true },
      { url: "/images/vehicules/toyota-prado-tissu/02.jpg", alt: "Profil du Prado noir" },
      { url: "/images/vehicules/toyota-prado-tissu/03.jpg", alt: "Poste de conduite du Prado" },
      { url: "/images/vehicules/toyota-prado-tissu/04.jpg", alt: "Troisième rangée de sièges, portière ouverte" },
      { url: "/images/vehicules/toyota-prado-tissu/05.jpg", alt: "Prado noir vu de trois quarts arrière" },
    ],
    partenaire: COLLECTE,
    verifie: true,
  },
];

/** Lieux connus proposés dans les champs de départ et d'arrivée. */
export const LIEUX = [
  { valeur: "Aéroport AIBD", detail: "Aéroport international Blaise-Diagne" },
  { valeur: "Stade Abdoulaye-Wade", detail: "Diamniadio" },
  { valeur: "Dakar Arena", detail: "Diamniadio" },
  { valeur: "Village olympique", detail: "Diamniadio" },
  { valeur: "Plateau", detail: "Dakar" },
  { valeur: "Almadies", detail: "Dakar" },
  { valeur: "Ngor", detail: "Dakar" },
  { valeur: "Mermoz", detail: "Dakar" },
  { valeur: "Saly", detail: "Mbour" },
];
