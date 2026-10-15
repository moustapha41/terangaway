/**
 * Configuration de l'API, lue une fois au démarrage.
 *
 * Toute valeur qui change entre les environnements passe par ici. Rien n'est
 * lu via `process.env` ailleurs dans le code : une valeur manquante doit faire
 * échouer le démarrage, pas une requête au hasard trois jours plus tard.
 */
function requis(nom: string, defaut?: string): string {
  const valeur = process.env[nom] ?? defaut;
  if (valeur === undefined) {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return valeur;
}

export const config = {
  port: Number(requis("PORT", "3001")),
  environnement: requis("NODE_ENV", "development"),
  /** Origines autorisées à appeler l'API, séparées par des virgules. */
  originesAutorisees: requis("ORIGINES_AUTORISEES", "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** Durée de validité d'un jeton de réponse partenaire, en minutes (PAR-11). */
  dureeJetonMinutes: Number(requis("DUREE_JETON_MINUTES", "120")),
  /** Délai de réponse accordé au partenaire sur une demande, en minutes. */
  delaiReponseMinutes: Number(requis("DELAI_REPONSE_MINUTES", "120")),
  /** Préavis minimal pour une prise en charge, en heures (§B.3). */
  delaiMinimumHeures: Number(requis("DELAI_MINIMUM_HEURES", "2")),
} as const;

export type Config = typeof config;
