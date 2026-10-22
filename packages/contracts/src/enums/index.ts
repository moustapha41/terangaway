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
  "internet",
] as const;
export type ServiceALaDemande = (typeof SERVICES_A_LA_DEMANDE)[number];

/**
 * Les états d'un acompte réglé par virement bancaire.
 *
 * **Volontairement séparés des sept statuts de demande.** Ceux-ci décrivent
 * l'accord entre le visiteur et le partenaire, ils sont montrés dans la frise
 * et le paiement « n'en fait jamais partie » — c'est écrit plus haut et c'est
 * toujours vrai. L'acompte est un cycle *parallèle* : une demande acceptée
 * peut attendre son virement, l'avoir reçu en partie, ou l'avoir reçu après
 * son échéance, sans que son propre statut change. Les mêler aurait obligé à
 * rouvrir la table des transitions, la frise et les vingt-et-une clés de
 * traduction des statuts — et aurait fait voir au visiteur un état de
 * paiement là où il attend l'état de sa réservation.
 *
 * Sans agrégateur de paiement, aucun de ces états ne s'obtient en écoutant la
 * banque : `paye` est toujours le constat d'un humain qui a vérifié le compte.
 */
export const STATUTS_ACOMPTE = [
  /** Instructions de virement envoyées, rien reçu à ce jour. */
  "en_attente",
  /** Reçu, mais strictement moins que le montant attendu. */
  "partiel",
  /** Reçu en totalité, et confirmé par un administrateur. */
  "paye",
  /** Échéance dépassée sans réception confirmée. */
  "expire",
  /** La demande est morte avant le paiement : il ne faut plus virer. */
  "annule",
  /** Reçu alors qu'il ne fallait plus, ou reçu en trop : à rendre. */
  "a_rembourser",
  /**
   * Rendu. Posé seulement quand une personne a constaté que le remboursement
   * est parti du compte — jamais au moment où on décide de rembourser.
   */
  "rembourse",
] as const;
export type StatutAcompte = (typeof STATUTS_ACOMPTE)[number];

/**
 * Ce qu'une ligne du journal d'acompte raconte.
 *
 * Le journal est **append-only** : une étape nouvelle est une ligne nouvelle,
 * jamais la correction d'une ancienne. Un champ `montantRecu` seul ne peut pas
 * raconter deux versements successifs, un doublon, ni qui a vérifié quoi.
 *
 * Une `preuve_declaree` n'est **pas** une réception : c'est ce que quelqu'un
 * affirme avoir viré. Seule une `reception_confirmee`, posée par une personne
 * qui a regardé le compte, compte dans le montant reçu.
 */
export const TYPES_EVENEMENT_ACOMPTE = [
  /** Le dossier est ouvert : montant figé, échéance posée. */
  "preparation",
  "instructions_envoyees",
  "rappel_envoye",
  /** Le visiteur dit avoir payé, avec ou sans justificatif. Rien n'est constaté. */
  "preuve_declaree",
  /** Une personne a relevé le compte ; le commentaire dit ce qu'elle a vu. */
  "verification",
  /** Un versement constaté sur le compte. Seul à faire bouger le montant reçu. */
  "reception_confirmee",
  /** Un versement qui fait double emploi avec un autre. */
  "doublon_signale",
  /** Montant incorrect, virement sans référence, ou tout autre écart. */
  "anomalie_signalee",
  "expiration_prononcee",
  "annulation",
  "remboursement_decide",
  "remboursement_effectue",
  /**
   * Les instructions de virement ne sont pas parties, toutes tentatives
   * épuisées. Le dossier reste sans `instructionsEnvoyeesLe` : il se renvoie.
   */
  "envoi_echoue",
] as const;
export type TypeEvenementAcompte = (typeof TYPES_EVENEMENT_ACOMPTE)[number];
