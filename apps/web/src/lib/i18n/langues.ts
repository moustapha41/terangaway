export const LANGUES = ["fr", "en", "es"] as const;
export const LANGUE_DEFAUT = "fr" as const;
export type Langue = (typeof LANGUES)[number];

/** Libellés affichés dans le sélecteur, chacun dans sa propre langue. */
export const NOMS_LANGUE: Record<Langue, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
};

export function estLangue(valeur: string | undefined): valeur is Langue {
  return LANGUES.includes(valeur as Langue);
}

/**
 * Choisit une langue à partir de l'en-tête `Accept-Language`.
 * « La plateforme détecte la langue du téléphone » (§B.2, étape 1).
 */
export function detecterLangue(acceptLanguage: string | null): Langue {
  if (!acceptLanguage) return LANGUE_DEFAUT;

  const souhaits = acceptLanguage
    .split(",")
    .map((morceau) => {
      const [etiquette, ...parametres] = morceau.trim().split(";");
      const q = parametres.find((p) => p.startsWith("q="));
      return { etiquette: etiquette.toLowerCase(), poids: q ? Number(q.slice(2)) : 1 };
    })
    .sort((a, b) => b.poids - a.poids);

  for (const souhait of souhaits) {
    const base = souhait.etiquette.split("-")[0];
    if (estLangue(base)) return base;
  }
  return LANGUE_DEFAUT;
}
