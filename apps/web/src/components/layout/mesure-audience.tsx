import Script from "next/script";

/**
 * Le script de mesure d'audience, posé seulement s'il est configuré.
 *
 * Les deux valeurs sont lues **côté serveur, à chaque requête** : ce ne sont
 * pas des `NEXT_PUBLIC_*`, qui seraient figées dans le bundle à la
 * construction et exigeraient de reconstruire l'image pour changer d'adresse
 * ou d'identifiant de site. Ici, poser la variable dans Dokploy et
 * redémarrer suffit.
 *
 * Sans configuration, le composant ne rend rien : le site fonctionne sans
 * mesure, et aucun développement local n'envoie de visite fantôme au tableau
 * de bord de production.
 *
 * Umami ne pose aucun cookie et n'écrit aucune donnée personnelle : pas de
 * bandeau de consentement à prévoir.
 */
export function MesureAudience() {
  const base = process.env.UMAMI_URL?.trim().replace(/\/$/, "");
  const site = process.env.UMAMI_SITE_ID?.trim();
  if (!base || !site) return null;

  // Exactement la même variable que celle lue par le conteneur Umami, et non
  // une seconde qui dirait la même chose : deux noms à tenir accordés finissent
  // toujours par diverger, et le script répond alors 404 en silence — le site
  // marche, la mesure ne compte rien, et personne ne s'en aperçoit.
  //
  // C'est un **nom de chemin**, pas un domaine, et il est repris **tel quel** :
  // Umami sert le script à l'adresse exacte qu'on lui a donnée. « mesure »
  // donne `https://stats.exemple.com/mesure`, sans extension. Ajouter « .js »
  // ici — ce que faisait la première version — produisait un 404 silencieux :
  // le site marchait, la mesure ne comptait rien.
  const nom = (process.env.UMAMI_TRACKER_SCRIPT_NAME?.trim() || "mesure").replace(/^\//, "");

  return (
    <Script
      src={`${base}/${nom}`}
      data-website-id={site}
      strategy="afterInteractive"
      defer
    />
  );
}
