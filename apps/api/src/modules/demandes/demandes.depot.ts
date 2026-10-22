import { HttpStatus } from "@nestjs/common";
import type { Demande, ServiceALaDemande, StatutDemande } from "@teranga/contracts";

import { ErreurMetier } from "../../commun/erreurs";

/**
 * Le refus d'une transition devancée par une autre.
 *
 * Distinct de `TRANSITION_INTERDITE` : la transition était permise quand on l'a
 * décidée, c'est la demande qui a bougé depuis. Le statut actuel est rendu
 * pour qu'on sache ce qui a gagné.
 */
export function transitionConcurrente(id: string, statutLu: StatutDemande, actuel: StatutDemande): ErreurMetier {
  return new ErreurMetier(
    "TRANSITION_CONCURRENTE",
    `La demande ${id} est passée de « ${statutLu} » à « ${actuel} » entre-temps : rien n'a été modifié.`,
    HttpStatus.CONFLICT,
  );
}

export interface EntreeCreationLogement {
  logementId: string;
  debut: string;
  fin: string;
  personnes: number;
  heureArrivee?: string;
  message?: string;
  visiteurId: string;
}

export interface EntreeCreationVehicule {
  vehiculeId: string;
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee?: string;
  quand: string;
  passagers: number;
  bagages: number;
  vol?: string;
  message?: string;
  visiteurId: string;
}

export interface EntreeCreationService {
  service: ServiceALaDemande;
  /** La saisie du visiteur, champ par champ, telle que le formulaire la pose. */
  details: Record<string, string>;
  message?: string;
  visiteurId: string;
}

/**
 * Port des demandes.
 *
 * La création résout l'offre et fige le prix : c'est le dépôt qui lit le
 * catalogue (fixtures aujourd'hui, SQL demain), pas le service.
 */
export interface DepotDemandes {
  listerPourVisiteur(visiteurId: string): Promise<Demande[]>;
  parId(id: string): Promise<Demande | null>;
  creerLogement(entree: EntreeCreationLogement): Promise<Demande>;
  creerVehicule(entree: EntreeCreationVehicule): Promise<Demande>;
  /**
   * Un service sans catalogue : rien à résoudre, rien à figer.
   *
   * Le total vaut zéro — « sur devis » — et c'est l'équipe qui chiffre depuis
   * le backoffice. Écrire un prix ici reviendrait à promettre un montant que
   * personne n'a encore calculé.
   */
  creerService(entree: EntreeCreationService): Promise<Demande>;
  /**
   * Écrit une transition — **à condition** que la demande soit encore au
   * statut `statutLu`, celui sur lequel la transition a été décidée.
   *
   * Sans cette condition, deux transitions décidées sur la même lecture se
   * succédaient et la seconde effaçait la première : une demande confirmée par
   * le visiteur pouvait être déclarée expirée par le veilleur une seconde plus
   * tard, ou l'inverse. Maintenant, la seconde lève `TRANSITION_CONCURRENTE`
   * et rien d'elle n'est écrit — ni statut, ni frise, ni échéance, ni
   * coordonnées.
   *
   * Comparer le seul statut suffit : toute transition en change, et la table
   * n'a pas de retour en arrière. Une demande ne peut donc pas avoir quitté
   * `statutLu` puis y être revenue entre la lecture et l'écriture.
   */
  enregistrer(demande: Demande, statutLu: StatutDemande): Promise<Demande>;
  visiteurDe?(demandeId: string): Promise<string | null> | string | undefined;

  /**
   * Fabrique le jeton par lequel on répond à une demande sans se connecter.
   *
   * Il était fabriqué à la création et aussitôt perdu : seule son empreinte
   * était gardée, la valeur en clair n'allait nulle part. Quatorze jetons
   * dorment ainsi en base, qui n'ont jamais ouvert aucun écran. Il est donc
   * émis **au moment où on sait à qui l'envoyer**, et rendu une fois.
   *
   * `null` quand la demande ne porte aucun prestataire : il n'y a alors
   * personne à qui remettre ce pouvoir.
   */
  emettreJetonReponse?(demandeId: string): Promise<JetonReponse | null>;

  /**
   * Les demandes encore « envoyée » dont le délai de relance est passé.
   *
   * `seuils` donne, par genre, la date de création au-delà de laquelle une
   * demande est considérée en souffrance — les délais du PRD §10 ne sont pas
   * les mêmes pour un taxi (dix minutes) et pour un logement (une heure).
   *
   * Les demandes déjà relancées sont écartées : on prévient une fois. Une
   * alerte qui se répète toutes les cinq minutes finit dans un filtre, et le
   * jour où elle compte vraiment, personne ne la lit plus.
   */
  aRelancer?(seuils: Record<string, Date>, limite: number): Promise<DemandeARelancer[]>;

  /** Marque ces demandes comme relancées, pour ne pas les resignaler. */
  marquerRelancees?(ids: readonly string[]): Promise<void>;

  /**
   * Les demandes dont l'échéance est passée et qui attendent encore.
   *
   * Deux cas, et `expireLe` porte les deux : une demande « envoyée » que le
   * partenaire n'a pas honorée, et une demande « acceptée » que le visiteur
   * n'a pas confirmée. La table des transitions prévoit l'une et l'autre pour
   * l'acteur « systeme » depuis le premier jour ; il manquait seulement
   * quelqu'un pour les prononcer.
   */
  aExpirer?(maintenant: Date, limite: number): Promise<string[]>;
}

/**
 * Une demande que personne n'a traitée, telle que la relance en a besoin.
 *
 * Volontairement maigre : la relance dit quoi rouvrir, elle ne rejoue pas la
 * demande. Tout le reste est à un clic, dans le backoffice.
 */
export interface DemandeARelancer {
  id: string;
  reference: string;
  genre: string;
  titre: string;
  creeLe: string;
  expireLe?: string;
}

/** Le jeton en clair, et qui doit le recevoir. */
export interface JetonReponse {
  jeton: string;
  expireLe: string;
  prestataire: { id: string; nom?: string; email?: string };
}
