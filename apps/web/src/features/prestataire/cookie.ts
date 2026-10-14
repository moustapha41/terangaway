/**
 * Le nom du cookie de session, seul.
 *
 * Il vit dans son propre fichier parce que le middleware s'exécute dans le
 * runtime edge : s'il importait `session.ts`, il entraînerait `next/headers` et
 * les données de démonstration avec lui.
 */
export const COOKIE_SESSION = "teranga_prestataire";
