import type { StatutAcompte, StatutDemande, TypeEvenementAcompte } from "../enums";

/**
 * Les coordonnées du compte qui reçoit les acomptes.
 *
 * **Aucune valeur n'est écrite dans le code, nulle part.** Elles viennent de
 * la configuration de l'API, qui les refuse incomplètes (voir
 * `apps/api/src/config/configuration.ts`). Ce type ne décrit que leur forme :
 * le jour où une valeur apparaît dans un fichier du dépôt, c'est un défaut,
 * pas une commodité — quiconque modifie ces quatre champs détourne tous les
 * virements à venir.
 *
 * Elles ne sont pas un secret au sens d'une clé d'API — elles figurent sur
 * chaque e-mail d'instructions — mais elles sont une cible de fraude. D'où la
 * règle : une source unique, modifiable par une personne autorisée, et jamais
 * de copie par réservation qui empêcherait d'en changer.
 */
export interface BeneficiaireAcompte {
  /** Le titulaire du compte, tel qu'il doit être recopié par la banque. */
  titulaire: string;
  /** L'établissement teneur du compte. */
  banque: string;
  iban: string;
  /** Indispensable : la plupart des virements viennent de l'étranger. */
  bic: string;
}

/**
 * L'acompte attendu sur une réservation, et ce qu'on en a reçu.
 *
 * Les montants sont des **entiers de francs CFA**, comme `prixTotal` : le
 * franc n'a pas de subdivision en circulation, et introduire un décimal ici
 * ferait diverger le montant annoncé au visiteur du montant que sa banque
 * virera. `montantAttendu` fait foi — c'est lui que l'e-mail porte et c'est
 * sur lui que le rapprochement se fait, jamais un pourcentage recalculé plus
 * tard.
 *
 * `pourcentageApplique` est figé à la préparation, et c'est tout l'intérêt de
 * le stocker : un taux qui change la semaine suivante ne doit pas réécrire ce
 * qu'on a demandé à quelqu'un la semaine d'avant.
 */
export interface Acompte {
  id: string;
  demandeId: string;
  /** Le motif à inscrire sur le virement. Sans lui, rien n'est rapprochable. */
  referenceVirement: string;
  statut: StatutAcompte;
  /** Le taux au moment de la préparation, en pourcents entiers. */
  pourcentageApplique: number;
  /** Le total de la demande au moment du calcul, en FCFA. */
  montantTotal: number;
  /** Ce qu'on demande, en FCFA. */
  montantAttendu: number;
  /** Le cumul des réceptions confirmées, en FCFA. 0 tant que rien n'est venu. */
  montantRecu: number;
  devise: "XOF";
  /**
   * L'échéance propre de l'acompte.
   *
   * **Distincte de `Demande.expireLe`**, qui porte déjà deux sens selon le
   * statut — délai de réponse du partenaire, puis délai de confirmation du
   * visiteur. Lui en donner un troisième aurait rendu le résultat de la veille
   * ambigu et mélangé deux calendriers qui n'ont ni la même durée ni les mêmes
   * conséquences.
   */
  echeanceLe: string;
  /** Quand les instructions sont parties. Absent = elles ne sont pas parties. */
  instructionsEnvoyeesLe?: string;
  /** Quand le rappel est parti. Absent = pas encore rappelé. */
  rappeleLe?: string;
  /** Qui a constaté la réception. Jamais le système : il ne voit pas la banque. */
  confirmeParId?: string;
  confirmeLe?: string;
  /** La référence relevée sur le compte, quand elle est lisible. */
  referenceTransaction?: string;
  creeLe: string;
  misAJourLe: string;
}

/** Une ligne du journal d'un acompte. Écrite une fois, jamais modifiée. */
export interface EvenementAcompte {
  id: string;
  acompteId: string;
  type: TypeEvenementAcompte;
  /** Présents ensemble, quand l'événement fait changer le statut. */
  statutAvant?: StatutAcompte;
  statutApres?: StatutAcompte;
  /** En FCFA entiers. */
  montant?: number;
  /** Absent = le système. */
  acteurId?: string;
  referenceTransaction?: string;
  commentaire?: string;
  creeLe: string;
}

/**
 * Les moyens par lesquels un acompte peut être réglé, tous **manuels** : aucun
 * ne passe par une passerelle ni une API de paiement. Le virement est le moyen
 * historique ; Wave et Orange Money sont un transfert vers un numéro.
 */
export const MOYENS_ACOMPTE = ["virement", "wave", "orange-money"] as const;
export type MoyenAcompte = (typeof MOYENS_ACOMPTE)[number];

/** Un numéro Mobile Money qui reçoit des acomptes. Comme l'IBAN : jamais écrit dans le code. */
export interface CompteMobileMoney {
  operateur: Exclude<MoyenAcompte, "virement">;
  /** Normalisé : chiffres, avec « + » en tête s'il a été saisi. */
  numero: string;
  /** Le nom du bénéficiaire, tel que l'opérateur l'affiche au payeur. */
  titulaire: string;
}

/**
 * Tout ce qu'un visiteur reçoit pour payer, tel que la configuration le porte.
 * Réservé aux administrateurs : le visiteur, lui, le lit dans son e-mail.
 */
export interface CoordonneesPaiementAcompte {
  moyens: MoyenAcompte[];
  virement?: BeneficiaireAcompte;
  mobileMoney: CompteMobileMoney[];
  /** Consignes libres ajoutées à l'e-mail, 500 caractères au plus. */
  instructions?: string;
}

/** Ce qu'un acompte donnerait si on l'ouvrait maintenant — rien n'est écrit. */
export interface ApercuAcompte {
  pourcentage: number;
  montantTotal: number;
  montantAttendu: number;
  solde: number;
}

/** Comment un montant reçu se compare à ce qui reste dû. */
export type SensEcartAcompte = "exact" | "inferieur" | "superieur";

/** Ce que l'écran d'équipe affiche sur l'acompte d'une demande, en une lecture. */
export interface VueAcompteAdmin {
  /** Le verrou et la configuration permettent-ils de réclamer un acompte ? */
  actif: boolean;
  statutDemande: StatutDemande;
  /** Absent tant qu'aucun dossier n'est ouvert. */
  acompte?: Acompte;
  /**
   * Une autre demande confirmée occupe déjà l'offre aux mêmes dates : aucun acompte ne
   * s'ouvre, aucune instruction ne part. Toujours faux quand un dossier existe.
   */
  offreDejaConfirmee: boolean;
  /** Seulement sans dossier, acompte ouvert et demande éligible. */
  apercu?: ApercuAcompte;
  /** Ce qui reste à recevoir : attendu − reçu, jamais négatif. */
  resteDu?: number;
  /** Le solde de la réservation hors acompte : total − attendu. */
  soldeApresAcompte?: number;
  coordonnees?: CoordonneesPaiementAcompte;
  journal: EvenementAcompte[];
  /** Le nom à montrer pour chaque `acteurId` du journal. */
  acteurs: Record<string, string>;
  /** Ce que la machine à états permet maintenant — l'API reste juge à l'écriture. */
  actions: {
    preparer: boolean;
    confirmerReception: boolean;
    renvoyerInstructions: boolean;
    renvoyerConfirmation: boolean;
    deciderPaiementTardif: boolean;
    /** Un acompte payé ou partiel qui doit être rendu. */
    deciderRemboursement: boolean;
    /** Un remboursement décidé, que la personne a exécuté hors plateforme. */
    constaterRemboursement: boolean;
  };
}

/** Une réception à constater, saisie par la personne qui a relevé le compte. */
export interface SaisieReceptionAcompte {
  /** Le montant réellement reçu, en FCFA entiers. */
  montant: number;
  /**
   * Le cumul reçu que l'écran affichait. S'il a changé entre-temps — un autre
   * administrateur, un double clic —, la saisie est refusée plutôt que
   * comptée deux fois.
   */
  montantRecuAvant: number;
  referenceTransaction?: string;
  commentaire?: string;
  /** Obligatoire dès que le montant diffère du reste dû. */
  ecartConfirme?: boolean;
}

export type EtatEnvoiAcompte = "envoye" | "echec" | "sans_destinataire" | "non_requis";

export interface ResultatReceptionAcompte {
  acompte: Acompte;
  sens: SensEcartAcompte;
  /** Montant reçu − reste dû avant cette réception. Négatif = il manque encore. */
  ecart: number;
  /** L'e-mail de confirmation : un échec ne défait jamais l'enregistrement. */
  emailConfirmation: EtatEnvoiAcompte;
}
