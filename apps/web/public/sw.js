/**
 * Service worker de Teranga Way.
 *
 * Trois règles, et rien de plus :
 *   1. les ressources statiques sont servies depuis le cache, mises à jour en fond ;
 *   2. une page demandée sans réseau tombe sur `/hors-ligne.html` ;
 *   3. **aucune requête d'écriture n'est mise en cache ni rejouée.**
 *
 * La troisième est la plus importante. Rejouer silencieusement l'envoi d'une
 * demande, c'est risquer de réserver deux fois un logement au nom de quelqu'un
 * qui croyait avoir échoué. Le dossier dit « l'envoi est désactivé ; il se
 * réactive au retour du réseau » (§B.7) : c'est l'interface qui attend, pas le
 * service worker qui devine.
 */
const VERSION = "teranga-v1";
const SOCLE = [
  "/hors-ligne.html",
  "/icons/icone.svg",
  "/icons/icone-192.png",
  "/modeles/logements.csv",
  "/modeles/vehicules.csv",
];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SOCLE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;

  // Seules les lectures passent par ici. POST, PUT et DELETE vont au réseau, point.
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  // Les actions serveur de Next passent par un GET spécial : on ne s'en mêle pas.
  if (url.pathname.startsWith("/_next/data") || requete.headers.has("Next-Action")) return;

  if (requete.mode === "navigate") {
    evenement.respondWith(
      fetch(requete).catch(() => caches.match("/hors-ligne.html")),
    );
    return;
  }

  // Statique : cache d'abord, réseau en secours, et on range au passage.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") ||
      url.pathname.startsWith("/images") || url.pathname.startsWith("/modeles")) {
    evenement.respondWith(
      caches.match(requete).then(
        (enCache) =>
          enCache ||
          fetch(requete).then((reponse) => {
            const copie = reponse.clone();
            caches.open(VERSION).then((cache) => cache.put(requete, copie));
            return reponse;
          }),
      ),
    );
  }
});
