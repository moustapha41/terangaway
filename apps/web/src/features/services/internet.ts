export interface Operateur {
  cle: string;
  /** Un nom commercial ne se traduit pas. */
  nom: string;
}

/**
 * Les trois opérateurs mobiles du Sénégal.
 *
 * **Vérifié en octobre 2026.** Rien ici n'est un tarif : les prix des pass
 * changent plusieurs fois par an et une page qui les fige ment au bout de six
 * mois. Les ordres de grandeur affichés sont dans le catalogue de langues,
 * présentés comme tels, et la page dit où lire le prix du jour.
 */
export const OPERATEURS: readonly Operateur[] = [
  { cle: "orange", nom: "Orange (Sonatel)" },
  { cle: "free", nom: "Free Sénégal" },
  { cle: "expresso", nom: "Expresso" },
];

/** Obtenir une puce locale, dans l'ordre. */
export const ETAPES_SIM = ["papiers", "boutique", "identification", "pass", "recharge"] as const;

/** Se connecter sans passer par une boutique. */
export const OPTIONS_SANS_SIM = ["esim", "roaming", "wifiLogement", "boxPortable"] as const;

/** Ce que la couverture vaut réellement, selon où l'on va. */
export const ZONES_COUVERTURE = ["dakar", "villes", "brousse"] as const;

/** À savoir avant de partir. */
export const CONSEILS_INTERNET = ["telephoneDebloque", "doubleSim", "wave", "whatsapp"] as const;
