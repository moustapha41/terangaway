/**
 * Le cookie de session de l'équipe, seul dans son fichier.
 *
 * Séparé du cookie visiteur, et pas seulement par prudence : la même personne
 * peut être connectée côté site et côté backoffice dans le même navigateur, et
 * un cookie partagé aurait fait de chaque déconnexion visiteur une sortie du
 * backoffice.
 */
export const COOKIE_ADMIN = "teranga_admin";

/** Huit heures : une journée de travail, pas trente jours comme un visiteur. */
export const DUREE_SESSION_ADMIN_SECONDES = 8 * 60 * 60;
