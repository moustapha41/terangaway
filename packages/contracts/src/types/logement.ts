import type { Equipement, Inclus, MoyenDePaiement, TypeLogement } from "../enums";
import type { LignePrix } from "../prix";

export interface Photo {
  url: string;
  /** Texte alternatif, obligatoire : « chaque photo a un texte alternatif » (§C.6). */
  alt: string;
  principale?: boolean;
}

/**
 * Une visite filmée.
 *
 * Plusieurs propriétaires n'ont envoyé qu'une vidéo WhatsApp : pas une photo.
 * En extraire des images donne des vignettes utilisables, mais la visite elle-
 * même en dit plus long qu'une poignée de trames floues — elle reste donc sur
 * la fiche, à côté des photos qu'on en a tirées.
 *
 * La bande son est retirée au montage : le propriétaire y parle, et sa voix
 * porte volontiers un numéro ou une adresse, que la fiche ne livre pas avant
 * confirmation (§D.4).
 */
export interface VideoLogement {
  url: string;
  /** Image d'attente, affichée avant lecture : une trame de cette vidéo. */
  poster: string;
  /** Ce que la visite montre, pour qui ne peut pas la regarder. */
  legende: string;
  /** Durée en secondes, annoncée avant de lancer la lecture. */
  duree: number;
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
  /**
   * Tarif de la semaine annoncé par le propriétaire, quand il en annonce un.
   *
   * Plusieurs annonces portent un barème dégressif : sept nuits y coûtent moins
   * que sept fois la nuitée. L'écran annonce la semaine (§C.4) ; sans ce champ
   * il multiplierait par sept et afficherait un prix que le propriétaire n'a
   * jamais demandé.
   */
  prixParSemaine?: number;
  /**
   * Loyer mensuel annoncé par le propriétaire, quand il en annonce un.
   *
   * Certains appartements de Dakar ne se louent qu'au mois. Leur `prixParNuit`
   * n'est alors que ce loyer divisé par trente : un chiffre de calcul, que
   * personne n'a jamais demandé à la nuitée. `seulementAuMois` dit à l'écran
   * d'afficher le loyer, et non cette division.
   */
  prixParMois?: number;
  /** Le propriétaire ne loue qu'au mois : voir `prixParMois`. */
  seulementAuMois?: true;
  fraisFixes?: { libelle: string; montant: number }[];
  sejourMinimum?: number;
  inclus: Inclus[];
  equipements: Equipement[];
  regles?: string[];
  conditionsAnnulation: string;
  moyensDePaiement: MoyenDePaiement[];
  photos: Photo[];
  /** Visites filmées envoyées par le propriétaire, quand il y en a. */
  videos?: VideoLogement[];
  /**
   * Les « photos » ne sont que des trames de la visite filmée.
   *
   * Quelques propriétaires n'ont envoyé qu'une vidéo. On en tire des images
   * pour les cartes et la recherche, qui ont besoin d'une vignette, mais la
   * fiche montre alors **la visite** et non cette mosaïque de trames floues :
   * c'est le document d'origine, et il en dit bien plus long.
   */
  photosDeLaVisite?: true;
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
  /**
   * Comment l'hébergement a été chiffré, palier par palier — figé avec le total.
   * Absent des demandes antérieures à son enregistrement : le backoffice dit
   * alors que le détail n'a pas été conservé, plutôt que de le reconstituer d'après
   * un catalogue qui a pu changer.
   */
  lignes?: LignePrix[];
}
