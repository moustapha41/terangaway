import type { ServiceALaDemande } from "@teranga/contracts";

/**
 * Ce qu'on demande au visiteur, service par service.
 *
 * Un formulaire unique aurait obligé l'équipe à rappeler pour tout préciser :
 * un nombre de couverts n'a rien à voir avec une catégorie de billet. Chaque
 * service déclare donc ses champs, et le formulaire se construit à partir d'ici.
 *
 * Aucun prix n'est demandé ni affiché : il n'y a pas de catalogue, c'est
 * l'équipe qui chiffre ensuite.
 */
export type TypeChamp = "texte" | "nombre" | "date" | "choix" | "zone";

export interface Champ {
  /** Clé technique, retenue telle quelle dans la demande. */
  cle: string;
  type: TypeChamp;
  /** Les valeurs d'un champ « choix », traduites par `services.champ.<cle>.<valeur>`. */
  valeurs?: readonly string[];
  obligatoire?: boolean;
  /** Bornes d'un champ « nombre ». */
  min?: number;
  max?: number;
}

const DATES: Champ[] = [
  { cle: "date", type: "date", obligatoire: true },
  { cle: "personnes", type: "nombre", obligatoire: true, min: 1, max: 60 },
];

export const CHAMPS: Record<ServiceALaDemande, readonly Champ[]> = {
  guides: [
    ...DATES,
    { cle: "langue", type: "choix", valeurs: ["francais", "anglais", "espagnol", "wolof"], obligatoire: true },
    { cle: "duree", type: "choix", valeurs: ["demi-journee", "journee", "plusieurs-jours"] },
  ],
  restauration: [
    ...DATES,
    { cle: "moment", type: "choix", valeurs: ["midi", "soir"], obligatoire: true },
    { cle: "cuisine", type: "choix", valeurs: ["senegalaise", "internationale", "indifferent"] },
    { cle: "quartier", type: "texte" },
  ],
  assistance: [
    ...DATES,
    {
      cle: "besoin",
      type: "choix",
      valeurs: ["accueil-aeroport", "demarches", "sante", "traduction", "autre"],
      obligatoire: true,
    },
    { cle: "langue", type: "choix", valeurs: ["francais", "anglais", "espagnol", "wolof"] },
  ],
  decouverte: [
    ...DATES,
    {
      cle: "theme",
      type: "choix",
      valeurs: ["culture", "nature", "plages", "artisanat", "vie-nocturne"],
      obligatoire: true,
    },
    { cle: "duree", type: "choix", valeurs: ["demi-journee", "journee", "plusieurs-jours"] },
  ],
  // Pas de « personnes » ici : ce qui compte est le nombre de lignes, et une
  // famille de quatre ne prend pas toujours quatre cartes.
  internet: [
    { cle: "date", type: "date", obligatoire: true },
    { cle: "lignes", type: "nombre", obligatoire: true, min: 1, max: 20 },
    { cle: "formule", type: "choix", valeurs: ["sim-locale", "esim", "wifi-portable"], obligatoire: true },
    { cle: "donnees", type: "choix", valeurs: ["leger", "standard", "intensif"] },
    { cle: "livraison", type: "choix", valeurs: ["aeroport", "logement", "point-retrait"], obligatoire: true },
  ],
};

/** Le message libre, commun à tous : c'est souvent là que l'essentiel se dit. */
export const CHAMP_MESSAGE: Champ = { cle: "message", type: "zone" };
