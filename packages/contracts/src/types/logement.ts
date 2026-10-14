import type { Equipement, Inclus, MoyenDePaiement, TypeLogement } from "../enums";

export interface Photo {
  url: string;
  /** Texte alternatif, obligatoire : « chaque photo a un texte alternatif » (§C.6). */
  alt: string;
  principale?: boolean;
}

export interface Partenaire {
  id: string;
  /** Prénom et initiale seulement tant que la demande n'est pas confirmée. */
  nomAffiche: string;
  verifieLe: string;
  verifiePar: string;
  /** Année d'entrée sur la plateforme, affichée sur la fiche. */
  membreDepuis?: number;
  /** Structure déclarée et contrôlée, par opposition à un particulier. */
  professionnel?: boolean;
}

/**
 * Un avis laissé après un séjour terminé.
 *
 * Le dossier reportait les avis après le MVP ; la maquette du parcours logement
 * les affiche. Seul un séjour **terminé** peut en produire un — sinon la note ne
 * vaut rien.
 */
export interface Avis {
  id: string;
  auteur: string;
  note: number;
  date: string;
  texte: string;
}

/**
 * Ce que le visiteur reçoit **avant** confirmation.
 *
 * Ni adresse exacte, ni téléphone, ni e-mail : « l'adresse exacte et les numéros
 * de téléphone ne sont pas présents dans les réponses du serveur avant la
 * confirmation » (dossier de conception §D.4). Ce ne sont donc pas des champs
 * facultatifs — ils sont absents du type, pour qu'un écran ne puisse pas les
 * afficher par accident.
 */
export interface Logement {
  id: string;
  slug: string;
  type: TypeLogement;
  titre: string;
  ville: string;
  quartier: string;
  capacite: number;
  chambres: number;
  lits: number;
  sallesDeBain: number;
  prixParNuit: number;
  fraisFixes?: { libelle: string; montant: number }[];
  sejourMinimum?: number;
  inclus: Inclus[];
  equipements: Equipement[];
  regles?: string[];
  conditionsAnnulation: string;
  moyensDePaiement: MoyenDePaiement[];
  photos: Photo[];
  description: string;
  partenaire: Partenaire;
  /**
   * Note et nombre d'avis.
   *
   * Le dossier de conception reportait les avis après le MVP (§D.1) ; la maquette
   * du parcours logement les affiche sur chaque carte. On suit la maquette, qui
   * est postérieure, et on note l'écart.
   */
  note?: number;
  nombreAvis?: number;
  /** Position approximative du quartier, pour la vue carte. Jamais l'adresse exacte. */
  position?: { latitude: number; longitude: number };
  /** Rien ne s'affiche sans avoir été vérifié : ce drapeau est toujours vrai côté visiteur. */
  verifie: true;
}

/** Les coordonnées, révélées seulement après la confirmation du visiteur. */
export interface CoordonneesLogement {
  adresseExacte: string;
  telephone: string;
  consignesArrivee?: string;
}

/** Le détail du prix, figé à l'envoi de la demande. */
export interface PrixSejour {
  prixParNuit: number;
  nuits: number;
  fraisFixes: { libelle: string; montant: number }[];
  total: number;
}
