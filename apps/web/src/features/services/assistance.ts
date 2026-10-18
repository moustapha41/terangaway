import type { NomIcone } from "@teranga/ui";

export interface DomaineAssistance {
  /** Préfixe des clés : `assistance.domaine.<cle>Titre`, `…Texte`. */
  cle: string;
  icone: NomIcone;
  /**
   * Valeur du champ « besoin » du formulaire que ce domaine présélectionne.
   * Les domaines qui n'en ont pas retombent sur « autre » : le formulaire ne
   * déclare que cinq besoins, la page en détaille neuf.
   */
  besoin: "accueil-aeroport" | "demarches" | "sante" | "traduction" | "autre";
}

/**
 * Ce que l'équipe prend en charge.
 *
 * La liste est volontairement plus fine que les cinq cases du formulaire :
 * personne ne cherche « autre », on cherche « j'ai perdu mon passeport ». La
 * page nomme le cas, le formulaire le range.
 */
export const DOMAINES_ASSISTANCE: readonly DomaineAssistance[] = [
  { cle: "accueil", icone: "avion", besoin: "accueil-aeroport" },
  { cle: "demarches", icone: "verification", besoin: "demarches" },
  { cle: "sante", icone: "assistance", besoin: "sante" },
  { cle: "traduction", icone: "guide", besoin: "traduction" },
  { cle: "documents", icone: "alerte", besoin: "autre" },
  { cle: "argent", icone: "prix", besoin: "autre" },
  { cle: "achats", icone: "valise", besoin: "autre" },
  { cle: "familles", icone: "enfant", besoin: "autre" },
  { cle: "accessibilite", icone: "personnes", besoin: "autre" },
];

/** Les étapes d'une demande, de l'envoi au règlement. */
export const ETAPES_ASSISTANCE = ["decrire", "reponse", "referent", "regler"] as const;

/** Les trois régimes de délai, du plus urgent au plus préparé. */
export const DELAIS_ASSISTANCE = ["urgence", "jour", "prepare"] as const;
