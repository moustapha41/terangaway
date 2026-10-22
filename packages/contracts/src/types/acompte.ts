import type { StatutAcompte, TypeEvenementAcompte } from "../enums";

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
