import type {
  ServiceALaDemande,
  Avis,
  CriteresLogement,
  Demande,
  Logement,
  MotifRefus,
  Facettes,
  ResultatsLogements,
  Vehicule,
} from "@teranga/contracts";
import {
  apiAnnulerDemande,
  apiConfirmerDemande,
  apiConnexionPrestataire,
  apiCreerDemandeLogement,
  apiCreerDemandeService,
  apiCreerDemandeVehicule,
  apiListerDemandes,
  apiObtenirDemande,
  apiOuvrirJeton,
  apiRepondreAvecJeton,
  type ContactDemande,
} from "@/lib/api/ecriture";
import { apiMockActive, ErreurApi } from "@/lib/api/http";
import { prixSemaine, totalSejour } from "@/lib/prix";
import { traduireLogement } from "@teranga/fixtures/traduire";
import type { FacettesVehicules, Lieu } from "@/lib/api/lecture";
import { LOGEMENTS } from "./fixtures/logements";
import { avisDe } from "./fixtures/avis";
import { LIEUX } from "./fixtures/vehicules";
import { VILLES } from "./fixtures/logements";
import { DEMANDES } from "./fixtures/demandes";
import { JETONS, type EtatJeton, type Jeton } from "./fixtures/jetons";
import { VEHICULES } from "./fixtures/vehicules";
import {
  CODE_PRESTATAIRE,
  DEMANDES_RECUES,
  OFFRES,
  OFFRES_VEHICULES,
  PHOTOS_MINIMUM,
  type DemandeRecue,
  type OffreDuPartenaire,
  type OffreVehicule,
  type Periode,
} from "./fixtures/prestataire";

/**
 * L'API simulée. Le frontend avance sans attendre le serveur (STRUCTURE.md),
 * mais il parle déjà le format de `@teranga/contracts` : le jour où l'API arrive,
 * seul ce fichier disparaît.
 *
 * Les cinq états d'écran (§B.7) se déclenchent par la requête, pour qu'on puisse
 * les regarder sans débrancher le réseau :
 *   ?etat=vide        aucun résultat
 *   ?etat=erreur      le serveur ne répond pas
 *   ?etat=lent        trois secondes, pour voir les squelettes
 */
export type EtatSimule = "normal" | "vide" | "erreur" | "lent";

export class ErreurServeur extends Error {
  constructor() {
    super("Le serveur de démonstration a renvoyé une erreur volontaire.");
    this.name = "ErreurServeur";
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Le tri des résultats.
 *
 * Sans consigne, c'est **le prix croissant** : le visiteur des Jeux compare
 * d'abord ce qu'il va payer, et la pertinence — qui classait par note —
 * mettait en tête des logements plus chers sans le dire. Elle reste proposée
 * dans la liste déroulante, mais elle ne s'impose plus à qui n'a rien demandé.
 */
function trier(logements: Logement[], tri: CriteresLogement["tri"]): Logement[] {
  const copie = [...logements];
  switch (tri) {
    case "prix-decroissant":
      return copie.sort((a, b) => prixSemaine(b) - prixSemaine(a));
    case "capacite":
      return copie.sort((a, b) => b.capacite - a.capacite);
    case "note":
      return copie.sort((a, b) => (b.note ?? 0) - (a.note ?? 0));
    case "pertinence":
      // Les mieux notés d'abord, à prix comparable.
      return copie.sort((a, b) => (b.note ?? 0) - (a.note ?? 0) || prixSemaine(a) - prixSemaine(b));
    default:
      // Le moins cher d'abord, à la semaine — l'unité qui s'affiche.
      return copie.sort((a, b) => prixSemaine(a) - prixSemaine(b));
  }
}

/**
 * Compteurs des filtres.
 *
 * Calculés sur le catalogue de la ville, **avant** application des filtres :
 * sinon cocher « Villa » ferait tomber tous les autres compteurs à zéro et le
 * panneau deviendrait inutilisable.
 */
function calculerFacettes(logements: Logement[]): Facettes {
  const compter = <T extends string>(valeurs: T[]) =>
    valeurs.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

  const prix = logements.map(prixSemaine);

  return {
    total: logements.length,
    types: compter(logements.map((l) => l.type)),
    quartiers: compter(logements.map((l) => l.quartier)),
    equipements: compter(logements.flatMap((l) => l.equipements)),
    prix: {
      min: prix.length ? Math.min(...prix) : 0,
      max: prix.length ? Math.max(...prix) : 0,
    },
  };
}


export async function chercherLogements(
  criteres: Partial<CriteresLogement>,
  etat: EtatSimule = "normal",
  /** La langue de la page : les descriptions et les textes alternatifs suivent. */
  langue = "fr",
): Promise<ResultatsLogements> {
  if (etat === "erreur") throw new ErreurServeur();
  if (etat === "lent") await attendre(3000);
  else if (apiMockActive()) await attendre(120);

  // La ville borne le catalogue ; les facettes se calculent sur ce périmètre.
  const perimetre = criteres.ville
    ? LOGEMENTS.filter((l) => l.ville.toLowerCase().includes(criteres.ville!.toLowerCase()))
    : LOGEMENTS;

  const facettes = calculerFacettes(perimetre);

  if (etat === "vide") return { elements: [], total: 0, page: 1, parPage: 12, facettes };

  let trouves = perimetre;

  if (criteres.personnes) trouves = trouves.filter((l) => l.capacite >= criteres.personnes!);
  if (criteres.capaciteMin) trouves = trouves.filter((l) => l.capacite >= criteres.capaciteMin!);
  if (criteres.types?.length) trouves = trouves.filter((l) => criteres.types!.includes(l.type));
  if (criteres.quartiers?.length) {
    trouves = trouves.filter((l) => criteres.quartiers!.includes(l.quartier));
  }
  if (criteres.equipements?.length) {
    trouves = trouves.filter((l) => criteres.equipements!.every((e) => l.equipements.includes(e)));
  }
  // Les bornes sont celles de l'écran, donc des prix à la semaine.
  if (criteres.prixMin) trouves = trouves.filter((l) => prixSemaine(l) >= criteres.prixMin!);
  if (criteres.prixMax) trouves = trouves.filter((l) => prixSemaine(l) <= criteres.prixMax!);

  const elements = trier(trouves, criteres.tri).map((l) => traduireLogement(l, langue));
  return { elements, total: elements.length, page: 1, parPage: 12, facettes };
}

export async function obtenirLogement(slug: string, langue = "fr"): Promise<Logement | null> {
  if (!slug) return null;
  if (apiMockActive()) await attendre(80);
  const trouve = LOGEMENTS.find((l) => l.slug === slug);
  return trouve ? traduireLogement(trouve, langue) : null;
}

/* ───────────────────────── Demande ───────────────────────── */

export type EtatEnvoi = "normal" | "pris";

/** Le logement vient d'être pris pendant que le visiteur remplissait sa demande (§B.8). */
export class LogementPris extends Error {
  constructor(public readonly alternatives: Logement[]) {
    super("Ce logement vient d'être pris.");
    this.name = "LogementPris";
  }
}

export class CodeInvalide extends Error {
  constructor(public readonly raison: "faux" | "expire") {
    super("Le code n'est pas valable.");
    this.name = "CodeInvalide";
  }
}

export interface EntreeDemande {
  logementId: string;
  debut: string;
  fin: string;
  personnes: number;
  heureArrivee?: string;
  message?: string;
  /** Qui envoie, quand aucun compte n'est ouvert. */
  contact?: ContactDemande;
}

/**
 * Entrée d'une demande de transport.
 *
 * Le contrat `Demande` prévoyait les deux genres d'offre depuis le début
 * (`{ genre: "logement" } | { genre: "vehicule" }`) ; seul le chemin véhicule
 * manquait, et « Demander ce véhicule » tombait sur une page introuvable.
 */
export interface EntreeDemandeTransport {
  vehiculeId: string;
  /** Le service demandé : un trajet, une journée avec chauffeur, un taxi. */
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee?: string;
  /** Date et heure de prise en charge, au format ISO. */
  quand: string;
  passagers: number;
  bagages: number;
  /** Numéro de vol, quand la prise en charge est à l'aéroport. */
  vol?: string;
  message?: string;
  /** Qui envoie, quand aucun compte n'est ouvert. */
  contact?: ContactDemande;
}

/**
 * Le code de démonstration de la connexion et de l'inscription.
 *
 * L'envoi d'une demande ne demande plus de code : il ne reste donc qu'aux deux
 * parcours où l'on prouve vraiment qui l'on est.
 */
export const CODE_DE_DEMONSTRATION = "123456";

/**
 * Envoie une demande.
 *
 * Le prix est **figé ici** et ne bouge plus : c'est la règle de l'étape 4 (§B.2).
 * Aucun paiement n'est demandé, à aucun moment.
 */
export async function envoyerDemande(
  entree: EntreeDemande,
  etat: EtatEnvoi = "normal",
): Promise<Demande> {
  if (!apiMockActive() && etat === "normal") {
    return apiCreerDemandeLogement(entree);
  }

  await attendre(600);

  const logement = LOGEMENTS.find((l) => l.id === entree.logementId);
  if (!logement) throw new Error("Logement inconnu.");

  if (etat === "pris") {
    // « Trois logements proches disponibles » : jamais d'impasse (§B.1, §B.8).
    const proches = LOGEMENTS.filter(
      (l) => l.id !== logement.id && l.ville === logement.ville && l.capacite >= entree.personnes,
    ).slice(0, 3);
    throw new LogementPris(proches);
  }

  const jour = 24 * 60 * 60 * 1000;
  const nuits = Math.max(
    1,
    Math.round((new Date(entree.fin).getTime() - new Date(entree.debut).getTime()) / jour),
  );
  const fraisFixes = logement.fraisFixes ?? [];
  const total =
    totalSejour(logement, nuits, fraisFixes);

  const maintenant = new Date().toISOString();

  return {
    id: `d-${Date.now()}`,
    reference: `TW-${Math.floor(100000 + Math.random() * 900000)}`,
    statut: "envoyee",
    offre: {
      genre: "logement",
      logementId: logement.id,
      titre: logement.titre,
      vignette: logement.photos[0].url,
    },
    dates: { debut: entree.debut, fin: entree.fin },
    personnes: entree.personnes,
    heureArrivee: entree.heureArrivee,
    message: entree.message,
    prix: { prixParNuit: logement.prixParNuit, nuits, fraisFixes, total },
    frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
    // Le partenaire a 2 heures pour répondre sur un logement.
    expireLe: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Envoie une demande de transport.
 *
 * Même règle que pour un logement : rien n'est bloqué, rien n'est payé, et les
 * coordonnées du chauffeur n'arrivent qu'après confirmation (§D.4). Le délai de
 * réponse est plus court — un déplacement se décide vite.
 */
export async function envoyerDemandeTransport(
  entree: EntreeDemandeTransport,
  etat: EtatEnvoi = "normal",
): Promise<Demande> {
  if (!apiMockActive() && etat === "normal") {
    try {
      return await apiCreerDemandeVehicule(entree);
    } catch (e) {
      if (e instanceof ErreurApi && e.code === "DELAI_TROP_COURT") throw new DelaiTropCourt();
      throw e;
    }
  }

  await attendre(600);

  const vehicule = VEHICULES.find((v) => v.id === entree.vehiculeId);
  if (!vehicule) throw new Error("Véhicule inconnu.");

  // Le prix dépend de la prestation : un trajet est forfaitaire, une journée
  // avec chauffeur se compte au jour. On ne devine pas, on prend ce qui existe.
  const total =
    entree.prestation === "journee"
      ? (vehicule.prixParJour ?? vehicule.prixParTrajet ?? 0)
      : (vehicule.prixParTrajet ?? vehicule.prixParJour ?? 0);

  const maintenant = new Date().toISOString();

  return {
    id: `d-${Date.now()}`,
    reference: `TW-${Math.floor(100000 + Math.random() * 900000)}`,
    statut: "envoyee",
    offre: {
      genre: "vehicule",
      vehiculeId: vehicule.id,
      titre: `${vehicule.marque} ${vehicule.modele}`,
      vignette: vehicule.photos[0].url,
    },
    dates: { debut: entree.quand, fin: entree.quand },
    personnes: entree.passagers,
    message: entree.message,
    prix: { prixParNuit: total, nuits: 1, fraisFixes: [], total },
    frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
    // Une heure pour répondre sur un transport : un déplacement se décide vite.
    expireLe: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

/* ──────────────────── Services à la demande (V2) ──────────────────── */

export interface EntreeDemandeService {
  service: ServiceALaDemande;
  /** La saisie, champ par champ, telle que le service la déclare. */
  details: Record<string, string>;
  message?: string;
  /** Qui envoie, quand aucun compte n'est ouvert. */
  contact?: ContactDemande;
}

/**
 * Envoie une demande de service.
 *
 * Il n'y a pas de catalogue derrière : aucun prestataire n'est référencé pour
 * ces services. La demande part à l'équipe, qui cherche puis renvoie une
 * proposition chiffrée — d'où un prix à zéro à l'envoi, et un délai de réponse
 * de 24 heures au lieu de deux.
 *
 * La machine à sept statuts n'a pas besoin de changer : la table des
 * transitions permet déjà à « equipe » d'accepter ou de refuser.
 */
export async function envoyerDemandeService(
  entree: EntreeDemandeService,
  etat: EtatEnvoi = "normal",
): Promise<Demande> {
  if (!apiMockActive() && etat === "normal") {
    return apiCreerDemandeService(entree);
  }

  await attendre(600);

  const maintenant = new Date().toISOString();
  const quand = entree.details.date ?? maintenant.slice(0, 10);

  return {
    id: `d-${Date.now()}`,
    reference: `TW-${Math.floor(100000 + Math.random() * 900000)}`,
    statut: "envoyee",
    offre: {
      genre: "service",
      service: entree.service,
      titre: entree.service,
      details: entree.details,
    },
    dates: { debut: quand, fin: quand },
    personnes: Number(entree.details.personnes ?? 1),
    message: entree.message,
    // Aucun prix à l'envoi : c'est l'équipe qui chiffrera.
    prix: { total: 0 },
    frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
    // 24 heures : l'équipe doit chercher un prestataire, pas seulement répondre.
    expireLe: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/* ───────────────────────── Mes demandes ───────────────────────── */

/**
 * « Les demandes qui attendent une action du visiteur en tête, puis les autres,
 * de la plus récente à la plus ancienne » (§C.7, écran 5).
 *
 * Une seule demande attend vraiment le visiteur : celle qui est acceptée et qu'il
 * doit confirmer. C'est elle qui porte la pastille de la barre du bas.
 */
export function attendUneAction(demande: Demande): boolean {
  return demande.statut === "acceptee";
}

export async function listerDemandes(etat: EtatSimule = "normal"): Promise<Demande[]> {
  if (!apiMockActive() && etat === "normal") {
    return apiListerDemandes();
  }
  if (etat === "erreur") throw new ErreurServeur();
  if (etat === "lent") await attendre(3000);
  else await attendre(120);
  if (etat === "vide") return [];

  const recence = (d: Demande) => d.frise[0]?.horodatage ?? "";
  return [...DEMANDES].sort((a, b) => {
    const parAction = Number(attendUneAction(b)) - Number(attendUneAction(a));
    return parAction !== 0 ? parAction : recence(b).localeCompare(recence(a));
  });
}

export async function obtenirDemande(id: string): Promise<Demande | null> {
  if (!apiMockActive()) {
    try {
      return await apiObtenirDemande(id);
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 404) return null;
      throw e;
    }
  }
  await attendre(80);
  return DEMANDES.find((d) => d.id === id) ?? null;
}

/**
 * Confirmation et annulation.
 *
 * La mutation se fait en mémoire : les mocks vivent le temps du serveur de
 * développement. C'est volontairement la seule chose qui change ici — la
 * mécanique autour, action serveur et revalidation, est déjà celle de la vraie API.
 */
export async function confirmerDemande(id: string): Promise<Demande | null> {
  if (!apiMockActive()) {
    try {
      return await apiConfirmerDemande(id);
    } catch {
      return null;
    }
  }
  await attendre(400);
  const demande = DEMANDES.find((d) => d.id === id);
  if (!demande || demande.statut !== "acceptee") return null;

  demande.statut = "confirmee";
  demande.expireLe = undefined;
  demande.frise = [
    ...demande.frise,
    { statut: "confirmee", horodatage: new Date().toISOString(), origine: "visiteur" },
  ];
  // Les coordonnées n'existent qu'à partir d'ici (§D.4).
  demande.coordonnees = {
    adresseExacte: "12, route de la Corniche Ouest, Fann, Dakar",
    telephone: "+221 77 123 45 67",
    consignesArrivee: "Sonnez à l'interphone « Résidence », deuxième étage à droite.",
  };
  return demande;
}

export async function annulerDemande(id: string): Promise<Demande | null> {
  if (!apiMockActive()) {
    try {
      return await apiAnnulerDemande(id);
    } catch {
      return null;
    }
  }
  await attendre(400);
  const demande = DEMANDES.find((d) => d.id === id);
  if (!demande || STATUTS_FIGES.includes(demande.statut)) return null;

  demande.statut = "annulee";
  demande.expireLe = undefined;
  demande.coordonnees = undefined;
  demande.frise = [
    ...demande.frise,
    { statut: "annulee", horodatage: new Date().toISOString(), origine: "visiteur" },
  ];
  return demande;
}

const STATUTS_FIGES = ["terminee", "refusee", "expiree", "annulee"] as const as readonly string[];

/* ───────────────────────── Réponse du partenaire ───────────────────────── */

/**
 * Ce que le partenaire voit d'une demande.
 *
 * Ni nom, ni téléphone, ni message du visiteur : le partenaire ne les reçoit
 * qu'après la confirmation (§B.4, étape 4). La règle est symétrique de celle qui
 * protège le visiteur, et elle est portée par ce type.
 */
export interface DemandePourPartenaire {
  reference: string;
  /** Repris du contrat : un genre ajouté à `Demande` ne casse plus ici. */
  genre: Demande["offre"]["genre"];
  titre: string;
  dates: { debut: string; fin: string };
  personnes: number;
  heureArrivee?: string;
  total: number;
  expireLe: string;
}

export interface VueJeton {
  etat: EtatJeton;
  reponse?: Jeton["reponse"];
  demande?: DemandePourPartenaire;
}

export async function ouvrirJeton(jeton: string): Promise<VueJeton | null> {
  if (!apiMockActive()) {
    try {
      return await apiOuvrirJeton(jeton);
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 404) return null;
      throw e;
    }
  }
  await attendre(80);
  const trouve = JETONS.find((j) => j.jeton === jeton);
  if (!trouve) return null;

  // Un jeton périmé devient inerte, même si la base dit encore « valide ».
  const perime = new Date(trouve.expireLe).getTime() < Date.now();
  const etat: EtatJeton = trouve.etat === "valide" && perime ? "expire" : trouve.etat;

  if (etat !== "valide") return { etat, reponse: trouve.reponse };

  const demande = DEMANDES.find((d) => d.id === trouve.demandeId);
  if (!demande) return { etat: "expire" };

  return {
    etat,
    demande: {
      reference: demande.reference,
      genre: demande.offre.genre,
      titre: demande.offre.titre,
      dates: demande.dates,
      personnes: demande.personnes,
      heureArrivee: demande.heureArrivee,
      total: demande.prix.total,
      expireLe: trouve.expireLe,
    },
  };
}

export async function repondreAvecJeton(
  jeton: string,
  reponse: NonNullable<Jeton["reponse"]>,
  motif?: MotifRefus,
): Promise<boolean> {
  if (!apiMockActive()) {
    try {
      await apiRepondreAvecJeton(jeton, reponse, motif);
      return true;
    } catch {
      return false;
    }
  }
  await attendre(300);
  const trouve = JETONS.find((j) => j.jeton === jeton);
  if (!trouve || trouve.etat !== "valide") return false;

  trouve.etat = "repondu";
  trouve.reponse = reponse;

  const demande = DEMANDES.find((d) => d.id === trouve.demandeId);
  if (demande) {
    const statut = reponse === "acceptee" ? "acceptee" : "refusee";
    demande.statut = statut;
    demande.expireLe = undefined;
    if (statut === "refusee") {
      demande.motifRefus = reponse === "indisponible" ? "plus-disponible" : (motif ?? "autre");
    }
    demande.frise = [
      ...demande.frise,
      { statut, horodatage: new Date().toISOString(), origine: "partenaire" },
    ];
  }
  return true;
}

/* ───────────────────────── Transport ───────────────────────── */

export type BesoinTransport = "trajet" | "location" | "taxi";

/** Une prise en charge demandée à moins de deux heures est refusée (§B.3). */
export const DELAI_MINIMUM_HEURES = 2;

export class DelaiTropCourt extends Error {
  constructor() {
    super("La prise en charge est demandée dans moins de deux heures.");
    this.name = "DelaiTropCourt";
  }
}

export interface CriteresTrajet {
  depart: string;
  arrivee: string;
  quand: string;
  passagers: number;
  bagages: number;
  numeroVol?: string;
}

export function delaiSuffisant(quand: string, maintenant = new Date()): boolean {
  const ecart = new Date(quand).getTime() - maintenant.getTime();
  return ecart >= DELAI_MINIMUM_HEURES * 60 * 60 * 1000;
}

export async function chercherVehicules(
  besoin: BesoinTransport,
  criteres: { passagers?: number; bagages?: number; quand?: string },
  etat: EtatSimule = "normal",
): Promise<Vehicule[]> {
  if (etat === "erreur") throw new ErreurServeur();
  if (besoin === "trajet" && criteres.quand && !delaiSuffisant(criteres.quand)) {
    throw new DelaiTropCourt();
  }
  if (etat === "lent") await attendre(3000);
  else if (apiMockActive()) await attendre(120);
  if (etat === "vide") return [];

  const offre = besoin === "trajet" ? "trajet-avec-chauffeur" : "location-avec-chauffeur";

  // « Véhicules de capacité suffisante » : on ne propose jamais un véhicule trop petit.
  return VEHICULES.filter(
    (v) =>
      v.offresProposees.includes(offre) &&
      v.placesPassagers >= (criteres.passagers ?? 1) &&
      v.bagages >= (criteres.bagages ?? 0),
  ).sort((a, b) => (a.prixParTrajet ?? a.prixParJour ?? 0) - (b.prixParTrajet ?? b.prixParJour ?? 0));
}

/**
 * Compteurs de filtres de l'écran transport.
 *
 * Calculés sur le périmètre du besoin, chaque compteur neutralisant son propre
 * filtre — sans quoi cocher « SUV » ferait tomber les autres à zéro.
 */
export async function facettesVehicules(
  besoin: BesoinTransport,
  _criteres: Record<string, unknown> = {},
): Promise<FacettesVehicules> {
  const offre = besoin === "trajet" ? "trajet-avec-chauffeur" : "location-avec-chauffeur";
  const perimetre = VEHICULES.filter((v) => v.offresProposees.includes(offre));
  const compter = <T extends string>(valeurs: readonly T[], test: (v: Vehicule, x: T) => boolean) =>
    Object.fromEntries(valeurs.map((x) => [x, perimetre.filter((v) => test(v, x)).length]));
  const prixDe = (v: Vehicule) => v.prixParTrajet ?? v.prixParJour ?? 0;
  const prix = perimetre.map(prixDe);
  const PLAGES: Record<string, [number, number]> = { "1-3": [1, 3], "4-6": [4, 6], "7+": [7, 99] };

  return {
    total: perimetre.length,
    service: compter(
      ["trajet-avec-chauffeur", "location-avec-chauffeur", "location-sans-chauffeur", "taxi"] as const,
      (v, o) => v.offresProposees.includes(o),
    ),
    categorie: compter(["berline", "suv", "minibus", "taxi"] as const, (v, c) => v.categorie === c),
    places: compter(["1-3", "4-6", "7+"] as const, (v, p) => {
      const [a, b] = PLAGES[p];
      return v.placesPassagers >= a && v.placesPassagers <= b;
    }),
    prix: { min: prix.length ? Math.min(...prix) : 0, max: prix.length ? Math.max(...prix) : 0 },
  };
}

/**
 * Recherche par identifiant.
 *
 * Le site ne connaît parfois que l'identifiant — une demande, une réservation
 * — et non le slug public. Rien à voir avec `obtenirLogement`, qui part du
 * slug visible dans l'URL.
 */
export async function logementParId(id: string, langue = "fr"): Promise<Logement | null> {
  if (!id) return null;
  if (apiMockActive()) await attendre(60);
  const trouve = LOGEMENTS.find((l) => l.id === id);
  return trouve ? traduireLogement(trouve, langue) : null;
}

export async function vehiculeParId(id: string): Promise<Vehicule | null> {
  if (!id) return null;
  if (apiMockActive()) await attendre(60);
  return VEHICULES.find((v) => v.id === id) ?? null;
}

/** Les avis d'un logement. Déposés après un séjour terminé, jamais avant. */
export async function avisLogement(slug: string, nombre: number): Promise<Avis[]> {
  if (apiMockActive()) await attendre(60);
  const logement = LOGEMENTS.find((l) => l.slug === slug);
  return avisDe(logement?.id ?? "", nombre);
}

/**
 * Points de repère proposés à la saisie : aéroport, sites des Jeux, quartiers.
 *
 * Jamais l'adresse d'un partenaire — elle n'apparaît qu'après confirmation.
 */
export async function lieux(): Promise<Lieu[]> {
  if (apiMockActive()) await attendre(40);
  return [...LIEUX];
}

/**
 * Les villes où il y a quelque chose à réserver.
 *
 * L'API les déduit du catalogue : une ville sans offre n'apparaît pas. La
 * liste du site en portait un détail (« Sénégal », « Sites des Jeux ») que
 * l'API ne connaît pas — à reprendre si l'on veut l'afficher sous la
 * suggestion.
 */
export async function villes(): Promise<string[]> {
  if (apiMockActive()) await attendre(40);
  return VILLES.map((v) => v.valeur);
}

export async function obtenirVehicule(slug: string): Promise<Vehicule | null> {
  if (!slug) return null;
  if (apiMockActive()) await attendre(80);
  return VEHICULES.find((v) => v.slug === slug) ?? null;
}

/**
 * Taxi réservé : prix **indicatif**, sans liste de véhicules (§B.3).
 * L'équipe transmet la demande à un taxi partenaire ; son acceptation vaut
 * confirmation, il n'y a donc pas d'étape 6 pour le visiteur.
 */
export async function estimerTaxi(passagers: number): Promise<{ bas: number; haut: number }> {
  if (apiMockActive()) await attendre(120);
  const base = passagers > 4 ? 8000 : 5000;
  return { bas: base, haut: Math.round(base * 1.6) };
}

/* ───────────────────────── Espace prestataire ───────────────────────── */

export async function connexionPrestataire(telephone: string, code: string): Promise<boolean> {
  if (!apiMockActive()) {
    try {
      const res = await apiConnexionPrestataire(telephone, code);
      return Boolean(res?.prestataireId);
    } catch {
      throw new CodeInvalide("faux");
    }
  }
  await attendre(400);
  if (code !== CODE_PRESTATAIRE) throw new CodeInvalide("faux");
  return telephone.replace(/\D/g, "").length >= 9;
}

export async function offresDuPartenaire(): Promise<OffreDuPartenaire[]> {
  await attendre(120);
  return [...OFFRES].sort((a, b) => b.misAJourLe.localeCompare(a.misAJourLe));
}

export async function demandesRecues(): Promise<DemandeRecue[]> {
  await attendre(120);
  // Celles qui attendent une réponse d'abord : au-delà du délai, elles expirent.
  const urgente = (d: DemandeRecue) => Number(d.statut === "envoyee");
  return [...DEMANDES_RECUES].sort(
    (a, b) => urgente(b) - urgente(a) || b.recueLe.localeCompare(a.recueLe),
  );
}

export async function demandeRecue(id: string): Promise<DemandeRecue | null> {
  await attendre(80);
  return DEMANDES_RECUES.find((d) => d.id === id) ?? null;
}

export interface BrouillonLogement {
  type: string;
  titre: string;
  ville: string;
  quartier: string;
  capacite: number;
  chambres: number;
  prixParNuit: number;
  description: string;
  conditionsAnnulation: string;
}

/**
 * Dépôt d'une offre.
 *
 * Elle part en **validation**, jamais en ligne : « une seconde personne contrôle
 * et publie » (§B.5, et ADM-04). Le prestataire ne publie pas lui-même, et c'est
 * ce qui donne sa valeur au badge « vérifié ».
 */
export async function deposerOffre(brouillon: BrouillonLogement): Promise<OffreDuPartenaire> {
  await attendre(600);

  const offre: OffreDuPartenaire = {
    id: `o-${Date.now()}`,
    logement: {
      ...LOGEMENTS[0],
      id: `l-${Date.now()}`,
      slug: brouillon.titre.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      titre: brouillon.titre,
      ville: brouillon.ville,
      quartier: brouillon.quartier,
      capacite: brouillon.capacite,
      chambres: brouillon.chambres,
      prixParNuit: brouillon.prixParNuit,
      description: brouillon.description,
      conditionsAnnulation: brouillon.conditionsAnnulation,
      photos: [],
    },
    // Un dépôt part en brouillon : il manque encore les photos et les dates.
    statut: "brouillon",
    manquant: ["photos", "disponibilite"],
    misAJourLe: new Date().toISOString(),
    disponibilites: [],
  };

  OFFRES.unshift(offre);
  return offre;
}

export async function repondreDemandeRecue(
  id: string,
  reponse: "acceptee" | "refusee",
): Promise<void> {
  await attendre(400);
  const recue = DEMANDES_RECUES.find((d) => d.id === id);
  if (recue && recue.statut === "envoyee") {
    recue.statut = reponse;
    recue.expireLe = undefined;
  }
  const demande = DEMANDES.find((d) => d.id === id);
  if (demande && demande.statut === "envoyee") {
    demande.statut = reponse;
    demande.expireLe = undefined;
    demande.frise = [
      ...demande.frise,
      { statut: reponse, horodatage: new Date().toISOString(), origine: "partenaire" },
    ];
  }
}

/**
 * Recalcule ce qui bloque la publication.
 *
 * Une seule fonction décide : sinon la liste des offres et la page d'édition
 * finiraient par ne plus dire la même chose au partenaire.
 */
export function cequiManque(offre: OffreDuPartenaire): string[] {
  const manque: string[] = [];
  if (offre.logement.photos.length < PHOTOS_MINIMUM) manque.push("photos");
  if (offre.disponibilites.length === 0) manque.push("disponibilite");
  if (!offre.logement.prixParNuit) manque.push("prix");
  if (!offre.logement.description?.trim()) manque.push("description");
  return manque;
}

export async function offreDuPartenaire(id: string): Promise<OffreDuPartenaire | null> {
  await attendre(80);
  return OFFRES.find((o) => o.id === id) ?? null;
}

export async function enregistrerDisponibilites(id: string, periodes: Periode[]): Promise<void> {
  await attendre(300);
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) return;
  offre.disponibilites = periodes;
  offre.manquant = cequiManque(offre);
  offre.misAJourLe = new Date().toISOString();
}

export async function enregistrerTarifs(
  id: string,
  tarifs: {
    prixParNuit: number;
    sejourMinimum?: number;
    fraisFixes: { libelle: string; montant: number }[];
  },
): Promise<void> {
  await attendre(300);
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) return;
  offre.logement = {
    ...offre.logement,
    prixParNuit: tarifs.prixParNuit,
    sejourMinimum: tarifs.sejourMinimum,
    fraisFixes: tarifs.fraisFixes,
  };
  offre.manquant = cequiManque(offre);
  offre.misAJourLe = new Date().toISOString();
}

/**
 * Envoi en validation.
 *
 * Refusé tant qu'il manque un champ obligatoire : c'est la règle des modèles
 * d'envoi, et la refuser ici évite à l'équipe de contrôler des fiches incomplètes.
 */
export async function envoyerEnValidation(id: string): Promise<{ ok: boolean; manquant: string[] }> {
  await attendre(400);
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) return { ok: false, manquant: [] };

  const manque = cequiManque(offre);
  if (manque.length > 0) {
    offre.manquant = manque;
    return { ok: false, manquant: manque };
  }

  offre.statut = "en-validation";
  offre.manquant = [];
  offre.misAJourLe = new Date().toISOString();
  return { ok: true, manquant: [] };
}

export async function vehiculesDuPartenaire(): Promise<OffreVehicule[]> {
  await attendre(80);
  return [...OFFRES_VEHICULES].sort((a, b) => b.misAJourLe.localeCompare(a.misAJourLe));
}

export interface BrouillonVehicule {
  categorie: string;
  marque: string;
  modele: string;
  annee: number;
  placesPassagers: number;
  bagages: number;
  climatisation: boolean;
  zonesCouvertes: string[];
  offresProposees: string[];
  prixParTrajet?: number;
  prixParJour?: number;
}

/** Comme le logement : le dépôt crée un brouillon, l'équipe publie. */
export async function deposerVehicule(brouillon: BrouillonVehicule): Promise<OffreVehicule> {
  await attendre(600);

  const offre: OffreVehicule = {
    id: `ov-${Date.now()}`,
    vehicule: {
      ...VEHICULES[0],
      id: `v-${Date.now()}`,
      slug: `${brouillon.marque}-${brouillon.modele}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      categorie: brouillon.categorie as Vehicule["categorie"],
      marque: brouillon.marque,
      modele: brouillon.modele,
      annee: brouillon.annee,
      placesPassagers: brouillon.placesPassagers,
      bagages: brouillon.bagages,
      climatisation: brouillon.climatisation,
      zonesCouvertes: brouillon.zonesCouvertes,
      offresProposees: brouillon.offresProposees as Vehicule["offresProposees"],
      prixParTrajet: brouillon.prixParTrajet,
      prixParJour: brouillon.prixParJour,
      photos: [],
    },
    statut: "brouillon",
    manquant: ["photos"],
    misAJourLe: new Date().toISOString(),
  };

  OFFRES_VEHICULES.unshift(offre);
  return offre;
}

/* ───────────────────── Statistiques du prestataire ───────────────────── */

export interface Indicateur {
  cle: string;
  valeur: number;
  /** Variation par rapport à la période précédente, en points ou en pourcent. */
  variation: number;
  format: "nombre" | "note" | "montant";
}

export interface Repartition {
  total: number;
  attente: number;
  confirme: number;
  refuse: number;
  discussion: number;
}

export type PeriodeStat = "semaine" | "mois" | "annee";

/**
 * Chiffres du tableau de bord.
 *
 * Les « revenus estimés » le sont vraiment : aucun paiement ne passe par la
 * plateforme, le montant est donc ce que les réservations confirmées
 * représentent, pas ce qui a été encaissé. L'écran le dit.
 */
export async function statistiquesPrestataire(
  periode: PeriodeStat = "semaine",
): Promise<{ indicateurs: Indicateur[]; repartition: Repartition }> {
  await attendre(120);

  const facteur = periode === "semaine" ? 1 : periode === "mois" ? 4 : 42;
  const recues = DEMANDES_RECUES.length;
  const confirmees = DEMANDES_RECUES.filter((d) =>
    ["acceptee", "confirmee", "terminee"].includes(d.statut),
  ).length;
  const revenus = DEMANDES_RECUES.filter((d) =>
    ["acceptee", "confirmee", "terminee"].includes(d.statut),
  ).reduce((somme, d) => somme + d.total, 0);

  return {
    indicateurs: [
      { cle: "demandesRecues", valeur: recues * facteur, variation: 20, format: "nombre" },
      { cle: "reservationsConfirmees", valeur: confirmees * facteur, variation: 14, format: "nombre" },
      { cle: "noteMoyenne", valeur: 4.8, variation: 0.3, format: "note" },
      { cle: "revenusEstimes", valeur: revenus * facteur, variation: 18, format: "montant" },
    ],
    repartition: {
      total: recues * facteur,
      attente: DEMANDES_RECUES.filter((d) => d.statut === "envoyee").length * facteur,
      confirme: confirmees * facteur,
      refuse: DEMANDES_RECUES.filter((d) => d.statut === "refusee").length * facteur,
      discussion: DEMANDES_RECUES.filter((d) => d.statut === "expiree").length * facteur,
    },
  };
}
