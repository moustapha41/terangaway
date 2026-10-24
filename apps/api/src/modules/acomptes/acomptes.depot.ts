import type {
  Acompte,
  EvenementAcompte,
  StatutAcompte,
  StatutDemande,
  TypeEvenementAcompte,
} from "@teranga/contracts";

/**
 * Les changements de statut qu'un acompte peut connaître — et aucun autre.
 *
 * Le dépôt les fait respecter : un statut ne se pose jamais à la main, il se
 * franchit, et chaque franchissement laisse sa ligne au journal. Ce qui n'est
 * pas ici est refusé, y compris rester sur place.
 *
 * Deux franchissements ont des conditions en plus de la table, que le dépôt
 * vérifie aussi :
 *
 *   `expire → paye` est la **décision humaine** sur un paiement tardif : elle
 *   passe par un événement `verification` signé et commenté — la personne dit
 *   ce qu'elle a vérifié de la disponibilité. Jamais un automatisme ;
 *
 *   `a_rembourser → rembourse` exige un `remboursement_effectue` signé et
 *   chiffré : décider de rembourser n'est pas avoir remboursé.
 *
 * `rembourse` est final.
 */
export const TRANSITIONS_ACOMPTE: Readonly<Record<StatutAcompte, readonly StatutAcompte[]>> = {
  en_attente: ["partiel", "paye", "expire", "annule"],
  // Pas d'« annulé » ici : un acompte annulé n'a rien reçu. De l'argent reçu se
  // rend (« à rembourser »), il ne s'annule pas.
  partiel: ["paye", "expire", "a_rembourser"],
  paye: ["a_rembourser"],
  expire: ["paye", "a_rembourser"],
  // Final : annulé avant toute réception, il n'y a rien à rembourser.
  annule: [],
  a_rembourser: ["rembourse"],
  rembourse: [],
};

/**
 * Les statuts de demande sous lesquels un acompte peut être déclaré payé.
 *
 * Une demande expirée, annulée ou refusée est morte : l'argent qu'on reçoit
 * pour elle se rend, il ne se garde pas. Le dépôt le vérifie lui-même, au
 * moment d'écrire « payé », pour qu'aucun chemin — service, script, future
 * route — ne puisse l'oublier.
 *
 * `terminee` n'y figure pas : c'est la liste revue à l'étape 3, et l'élargir
 * est une décision produit.
 */
export const STATUTS_DEMANDE_PAYABLES: readonly StatutDemande[] = ["acceptee", "confirmee"];

export function transitionAcompteAutorisee(de: StatutAcompte, vers: StatutAcompte): boolean {
  return TRANSITIONS_ACOMPTE[de].includes(vers);
}

export interface EntreePreparationAcompte {
  demandeId: string;
  /** Le taux à figer, en pourcents entiers. Vient de la configuration. */
  pourcentage: number;
  /**
   * L'instant de l'acceptation de la demande, en ISO.
   *
   * C'est **l'acceptation** qu'on passe, et non l'échéance : celle-ci dépend du
   * genre de la demande — douze heures pour un logement, trois pour une
   * location — et le genre fin n'est lisible qu'en base, donc ici. Laisser
   * l'appelant calculer l'échéance lui faisait appliquer un délai unique à
   * tous les genres, puisque le contrat visiteur ne distingue pas une location
   * d'un trajet. Le dépôt la déduit lui-même, avec le plafond de `expireLe`.
   */
  accepteeLe: string;
}

export interface ResultatPreparationAcompte {
  acompte: Acompte;
  /** `false` quand le dossier existait déjà : rien n'a été écrit. */
  cree: boolean;
}

/** Ce qu'on ajoute au journal. L'identifiant et la date sont ceux de la base. */
export interface EntreeEvenementAcompte {
  type: TypeEvenementAcompte;
  /** En FCFA entiers, strictement positif. */
  montant?: number;
  /** Absent = le système. Obligatoire pour une réception confirmée. */
  acteurId?: string;
  referenceTransaction?: string;
  commentaire?: string;
}

/**
 * Le franchissement attendu : `de` est ce qu'on croit lire, `vers` ce qu'on
 * veut poser. Si quelqu'un d'autre a changé le statut entre-temps, l'écriture
 * est refusée plutôt que d'écraser sa décision.
 */
export interface TransitionAcompte {
  de: StatutAcompte;
  vers: StatutAcompte;
}

/**
 * Port des acomptes.
 *
 * Il **enregistre**, il ne réclame ni n'encaisse rien : aucune méthode
 * n'envoie d'e-mail, n'appelle de banque ni ne lit la configuration bancaire.
 * Un dossier peut exister sans que personne n'ait jamais été sollicité — c'est
 * `instructionsEnvoyeesLe` qui dira, plus tard, si on l'a été.
 *
 * Le journal est append-only : aucune méthode ne modifie ni n'efface un
 * événement, et la base refuse de le faire.
 */
/**
 * Ce qu'il faut pour écrire au visiteur, lu en une fois.
 *
 * Le statut de la demande y figure parce qu'une décision sur l'acompte en
 * dépend — on n'accepte pas un paiement tardif pour une demande morte — mais
 * le dépôt ne le modifie jamais.
 */
export interface ContexteAcompte {
  acompte: Acompte;
  reference: string;
  titre: string;
  statutDemande: StatutDemande;
  /** L'adresse du compte visiteur. Absente = personne à qui écrire. */
  emailVisiteur?: string;
}

/** Ce que le dépôt sait d'une demande, sans l'écrire ni la déformer. */
export interface LectureDemandePourAcompte {
  statutDemande: StatutDemande;
  /** Le genre fin, tel que la base le porte : `service`, `logement`, `taxi`… */
  genre: string;
  prixTotal: number;
  reference: string;
}

/** Une réception à constater : tout ce que la transaction doit trancher seule. */
export interface EntreeReceptionAcompte {
  acompteId: string;
  /** FCFA entiers, strictement positifs. */
  montant: number;
  /** Le cumul que l'appelant a lu. S'il a bougé, l'écriture est refusée. */
  montantRecuAvant: number;
  /** La personne qui a relevé le compte. Jamais le système. */
  acteurId: string;
  referenceTransaction?: string;
  commentaire?: string;
  /** L'écart (montant ≠ reste dû) a été reconnu par la personne. */
  ecartConfirme: boolean;
}

export type SensReception = "exact" | "inferieur" | "superieur";

export interface ResultatReceptionDepot {
  acompte: Acompte;
  sens: SensReception;
  /** Montant reçu − reste dû avant la réception. */
  ecart: number;
  /** `true` quand l'acompte était expiré : la réception est consignée, le statut intact. */
  tardive: boolean;
}

/** Mettre un acompte « à rembourser », au montant relu sous verrou. */
export interface EntreeARembourser {
  acompteId: string;
  /** Les seuls statuts d'où la décision est permise : le dépôt relit celui de la base. */
  depuisStatuts: readonly StatutAcompte[];
  /** `remboursement_decide` (une personne, obligatoire) ou `annulation` (le système). */
  type: "remboursement_decide" | "annulation";
  /** Absent = le système. Obligatoire pour `remboursement_decide`. */
  acteurId?: string;
  commentaire: string;
}

export interface DepotAcomptes {
  /**
   * Une autre demande **confirmée** occupe-t-elle déjà l'offre de cette demande, sur des
   * dates qui recouvrent les siennes ? Lecture seule, sans verrou : elle évite d'envoyer
   * des instructions de paiement pour une offre prise, elle ne remplace pas la garde
   * de la confirmation, qui seule fait foi.
   */
  offreDejaConfirmee(demandeId: string): Promise<boolean>;
  /**
   * Décide, en une transaction, que l'argent reçu est à rendre.
   *
   * Le dossier est verrouillé (`FOR UPDATE`) — le même verrou que celui d'une
   * réception — puis son statut et son **cumul** sont relus : le montant du
   * journal est celui qui est réellement dans le dossier à cet instant, jamais
   * celui qu'un écran ou un appelant avait lu avant. Une réception concurrente
   * passe avant (le cumul décidé l'inclut) ou après (elle est refusée, le
   * dossier n'attend plus de paiement) : jamais entre les deux.
   */
  declarerARembourser(entree: EntreeARembourser): Promise<Acompte>;
  /** Le nom à montrer pour chaque identifiant d'acteur du journal : nom, sinon adresse. */
  nomsActeurs(ids: readonly string[]): Promise<Record<string, string>>;
  /** La demande derrière un identifiant, pour décider d'ouvrir un dossier. */
  lireDemande(demandeId: string): Promise<LectureDemandePourAcompte | null>;
  /**
   * Constate un versement reçu, **en une transaction** : verrou sur le dossier
   * et sur la demande, cumul relu, écart jugé, statut posé, journal écrit.
   *
   * Deux administrateurs qui valident en même temps, ou un double clic, ne
   * comptent pas deux fois : la seconde saisie porte un cumul périmé et
   * reçoit un conflit. Une référence de transaction déjà consignée est
   * refusée. Un écart sans reconnaissance explicite l'est aussi.
   *
   * Ne touche jamais le statut de la demande.
   */
  enregistrerReception(entree: EntreeReceptionAcompte): Promise<ResultatReceptionDepot>;
  /**
   * Ouvre le dossier d'acompte d'une demande, ou rend celui qui existe.
   *
   * Idempotente : rappelée pour la même demande, elle rend le dossier existant
   * **tel quel** — même si le taux ou l'instant passés diffèrent. Le premier
   * dossier fait foi ; ce qu'on a annoncé à quelqu'un ne se réécrit pas. Deux
   * appels concurrents se départagent sur l'unicité de `demandeId`.
   *
   * Lit la demande — son genre, son total, son `expireLe` — sans jamais
   * l'écrire, et en déduit l'échéance. Refuse un genre non éligible, un total
   * nul et une échéance inexploitable : il n'y a alors rien à demander.
   */
  preparer(entree: EntreePreparationAcompte): Promise<ResultatPreparationAcompte>;
  parId(id: string): Promise<Acompte | null>;
  parDemande(demandeId: string): Promise<Acompte | null>;
  /**
   * Franchit une transition et la consigne, dans une seule transaction.
   *
   * L'événement porte le statut avant et après. Une réception confirmée
   * passée ici ajoute son montant au cumul reçu ; `paye` exige que ce cumul
   * atteigne le montant attendu et qu'un humain soit nommé.
   */
  changerStatut(
    acompteId: string,
    transition: TransitionAcompte,
    evenement: EntreeEvenementAcompte,
  ): Promise<Acompte>;
  /**
   * Ajoute une ligne au journal, sans changer ni le statut ni le cumul reçu.
   *
   * Réservé aux événements qui ne déplacent rien : instructions envoyées, rappel,
   * preuve déclarée (jamais une preuve), doublon ou anomalie signalés, échec d'envoi,
   * note de vérification. Une réception, une décision ou un changement d'état sont
   * refusés ici : ils passent par `enregistrerReception`, `declarerARembourser` ou
   * `changerStatut`, qui verrouillent le dossier et écrivent l'événement avec ce qu'il
   * explique. Ainsi le cumul ne bouge jamais sans la ligne qui l'explique.
   */
  consigner(acompteId: string, evenement: EntreeEvenementAcompte): Promise<EvenementAcompte>;
  /** Le journal, du plus ancien au plus récent. */
  journal(acompteId: string): Promise<EvenementAcompte[]>;
  contexte(acompteId: string): Promise<ContexteAcompte | null>;
  /**
   * Pose `instructionsEnvoyeesLe` et consigne `instructions_envoyees`, une
   * fois. À n'appeler qu'**après** un envoi réussi : un marqueur posé sur un
   * e-mail perdu, c'est un paiement qu'on ne réclamera jamais.
   *
   * `false` quand le marqueur était déjà posé : rien n'a été écrit.
   */
  marquerInstructionsEnvoyees(acompteId: string): Promise<boolean>;
}
