import type { MotifRefus, ServiceALaDemande, StatutDemande } from "../enums";
import type { Demande } from "./demande";

/**
 * Les genres d'offre, vus du backoffice.
 *
 * Plus fin que le `genre` du contrat visiteur : l'équipe trie les demandes de
 * transport par prestation — un taxi de nuit et une location à la journée
 * n'appellent pas le même partenaire ni le même délai.
 */
export const GENRES_DEMANDE = ["logement", "trajet", "location", "taxi", "service"] as const;
export type GenreDemande = (typeof GENRES_DEMANDE)[number];

/** Une personne, telle que le backoffice la montre : de quoi la rappeler. */
export interface ContactAdmin {
  id: string;
  nom?: string;
  email?: string;
  telephone?: string;
}

/**
 * Une demande vue par l'équipe, **avec tout ce qui va avec**.
 *
 * Le contrat visiteur cache ce qui ne le regarde pas : le prestataire
 * pressenti, les coordonnées de l'autre partie, les champs libres d'un service
 * à la demande. Le backoffice, lui, reçoit la demande entière — c'est lui qui
 * doit pouvoir rappeler, chercher un partenaire et chiffrer.
 *
 * Les coordonnées du visiteur en font partie **quel que soit le statut** :
 * c'est l'équipe qui appelle quand une demande traîne, et elle ne peut pas
 * attendre une confirmation pour obtenir un numéro. La règle §D.4 porte sur
 * l'échange entre visiteur et partenaire, pas sur le support.
 */
export interface DemandeAdmin extends Demande {
  genre: GenreDemande;
  creeLe: string;
  misAJourLe: string;
  visiteur: ContactAdmin;
  prestataire?: ContactAdmin;
  /** Renseigné pour les trois genres de transport, absent ailleurs. */
  transport?: {
    prestation?: string;
    depart?: string;
    arrivee?: string;
    bagages?: number;
    vol?: string;
  };
  /** Ce que le visiteur a décrit pour un service à la demande. */
  service?: {
    cle: ServiceALaDemande;
    details: Record<string, string>;
  };
  /** Écrite par l'équipe, jamais montrée au visiteur ni au partenaire. */
  noteInterne?: string;
  /** Proposition chiffrée pour un service sur devis, en francs CFA. */
  prixPropose?: number;
}

/** Ce sur quoi la liste se filtre. Tout est facultatif : sans rien, tout sort. */
export interface FiltresDemandesAdmin {
  statut?: StatutDemande;
  genre?: GenreDemande;
  service?: ServiceALaDemande;
  /** Référence, titre d'offre, nom, e-mail ou téléphone du visiteur. */
  recherche?: string;
  /** Bornes sur la date d'envoi, en AAAA-MM-JJ. */
  du?: string;
  au?: string;
  page?: number;
  parPage?: number;
}

export interface PageDemandesAdmin {
  demandes: DemandeAdmin[];
  total: number;
  page: number;
  parPage: number;
}

/**
 * Ce que l'équipe change sur une demande.
 *
 * Un seul objet pour toutes les actions : changer le statut, assigner un
 * partenaire, chiffrer, annoter. Elles arrivent souvent ensemble — on refuse
 * *et* on note pourquoi — et deux appels auraient laissé la moitié du travail
 * enregistrée si le second échouait.
 */
export interface MiseAJourDemandeAdmin {
  statut?: StatutDemande;
  motifRefus?: MotifRefus;
  prestataireId?: string | null;
  noteInterne?: string;
  prixPropose?: number | null;
}

/** Les compteurs du tableau de bord. */
export interface TableauDeBordAdmin {
  /** Demandes reçues aujourd'hui, depuis minuit, heure de Dakar. */
  aujourdhui: number;
  /** Envoyées et sans réponse : c'est la pile de travail. */
  aTraiter: number;
  /** Envoyées dont le délai de réponse est dépassé. */
  enRetard: number;
  parStatut: Record<StatutDemande, number>;
  parGenre: Record<GenreDemande, number>;
  /** Total toutes périodes confondues. */
  total: number;
}

/** Le compte de l'équipe, une fois la session vérifiée côté serveur. */
export interface CompteAdministrateur {
  id: string;
  email?: string;
  nom?: string;
}
