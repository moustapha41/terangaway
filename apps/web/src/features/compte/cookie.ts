/** Nom du cookie de session visiteur, isolé pour rester lisible par le middleware. */
export const COOKIE_VISITEUR = "teranga_visiteur";

/** Durée de validité du cookie de session visiteur : 30 jours (en secondes). */
export const DUREE_SESSION_SECONDES = 30 * 24 * 3600;

/**
 * Préfixe des jetons simulés, qui n'ont de sens que lorsque les mocks répondent.
 *
 * Il est exporté pour que personne n'ait à réécrire la chaîne : le jour où elle
 * change, un seul endroit bouge.
 */
export const PREFIXE_JETON_MOCK = "session-mock-";

/** Longueur minimale d'un jeton de session : en dessous, ce n'est pas un secret. */
const LONGUEUR_MINIMALE = 16;

/**
 * Valeurs publiques qu'on a déjà vues servir de session.
 *
 * Elles sont toutes plus courtes que `LONGUEUR_MINIMALE`, donc déjà écartées.
 * Les nommer quand même documente ce qui a réellement circulé en production et
 * protège le jour où quelqu'un abaissera le seuil de longueur.
 */
const VALEURS_PUBLIQUES = new Set(["visiteur-demo", "visiteur", "demo", "undefined", "null"]);

/**
 * Les mocks sont-ils actifs ?
 *
 * La lecture est recopiée depuis `lib/api/http.ts` au lieu d'être importée :
 * ce fichier est lu par le middleware, qui tourne sur le runtime Edge, et par
 * des composants client. Il doit rester sans aucune dépendance. `NEXT_PUBLIC_*`
 * est figé à la construction, la lecture est donc valable des deux côtés.
 */
function mocksActifs(): boolean {
  return process.env.NEXT_PUBLIC_API_MOCK !== "false";
}

/**
 * Ce cookie a-t-il la *forme* d'un jeton de session ?
 *
 * À lire pour ce que c'est : un filtre de forme, pas une authentification. Il
 * écarte sans frais ce qui n'a aucune chance d'être un jeton — une adresse
 * e-mail, `visiteur-demo`, une chaîne trop courte — pour éviter un aller-retour
 * vers l'API. Seule l'API, qui compare le condensé du jeton à ses sessions
 * vivantes, dit si la session existe vraiment.
 *
 * Toute page privée doit donc *aussi* appeler `visiteurConnecte()`. Le
 * middleware ne peut pas s'en charger : il ne doit pas appeler l'API à chaque
 * navigation, et il tourne avant le rendu.
 */
export function estJetonSessionValide(valeur?: string | null): boolean {
  if (!valeur || typeof valeur !== "string") return false;
  const nettoye = valeur.trim();

  if (nettoye.length < LONGUEUR_MINIMALE) return false;
  // Un jeton ne contient ni espace ni retour à la ligne.
  if (/\s/.test(nettoye)) return false;
  // Une adresse e-mail est une identité, jamais une preuve d'identité.
  if (nettoye.includes("@")) return false;
  if (VALEURS_PUBLIQUES.has(nettoye.toLowerCase())) return false;

  // Un jeton simulé ne vaut que si c'est le mock qui répond. Face à la vraie
  // API, il serait refusé de toute façon : autant le dire tout de suite.
  if (nettoye.startsWith(PREFIXE_JETON_MOCK)) return mocksActifs();

  return true;
}

/**
 * Génère un nom lisible et présentable à partir d'un identifiant ou d'une adresse e-mail.
 * Utilisable dans les composants client et serveur.
 */
export function nomLisible(identifiant?: string | null): string {
  if (!identifiant) return "";
  const local = identifiant.split("@")[0] ?? identifiant;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase())
    .join(" ");
}
