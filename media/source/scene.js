/**
 * Film de démonstration Teranga Way — moteur de rendu.
 *
 * Tout est piloté par un temps explicite : `rendre(t)` place la scène telle
 * qu'elle doit être à t secondes, sans jamais lire l'horloge. La même valeur de
 * t donne donc toujours exactement la même image — c'est ce qui permet de
 * capturer le film image par image, et de le rejouer à l'identique.
 *
 * `?t=12.5` fige une image ; sans paramètre, le film se joue en boucle.
 */
const DUREE = 30;

const LOGEMENTS = [
  { titre: "Villa avec piscine, Ngor", quartier: "Ngor", prix: "150 000", img: "img/logement-4.jpg" },
  { titre: "Hôtel Pullman Dakar", quartier: "Corniche", prix: "120 000", img: "img/logement-1.jpg" },
  { titre: "Résidence Almadies", quartier: "Almadies", prix: "95 000", img: "img/logement-2.jpg" },
];

// --- petites fonctions de temps -------------------------------------------
const borne = (x) => Math.max(0, Math.min(1, x));
/** Avancement de 0 à 1 entre deux instants. */
const entre = (t, debut, fin) => borne((t - debut) / (fin - debut));
/** Démarrage franc, arrivée douce : le mouvement d'interface par défaut. */
const adouci = (x) => 1 - Math.pow(1 - x, 3);
/** Apparition puis disparition, pour un plan qui passe. */
function voile(t, debut, fin, fondu = 0.45) {
  if (t < debut - fondu || t > fin + fondu) return 0;
  if (t < debut) return entre(t, debut - fondu, debut);
  if (t > fin) return 1 - entre(t, fin, fin + fondu);
  return 1;
}

const $ = (id) => document.getElementById(id);

// Les cartes de résultats sont bâties une fois, puis seulement déplacées.
const grille = $("r-grille");
LOGEMENTS.forEach((l) => {
  const c = document.createElement("article");
  c.className = "carte";
  c.innerHTML =
    `<div class="ph" style="background-image:url(${l.img})"></div>` +
    `<div class="bas"><span class="badge">✓ Vérifié</span>` +
    `<h3>${l.titre}</h3><p class="q">${l.quartier}</p>` +
    `<p class="px tab">${l.prix} FCFA <span>/ nuit</span></p></div>`;
  grille.appendChild(c);
});
$("fiche-photo").style.backgroundImage = "url(img/logement-4.jpg)";
$("fin-img").style.backgroundImage = "url(img/banner-dakar.jpg)";

// --- les six plans ---------------------------------------------------------
function rendre(t) {
  // 1. Ouverture : la marque se pose, le filet s'étire, l'accroche monte.
  const o = voile(t, 0.0, 3.6);
  $("ouverture").style.opacity = o;
  const marque = adouci(entre(t, 0.25, 1.5));
  $("ouverture").querySelector(".marque").style.transform =
    `translateY(${(1 - marque) * 16}px)`;
  $("ouverture").querySelector(".marque").style.opacity = marque;
  $("filet").style.width = `${adouci(entre(t, 1.0, 2.1)) * 300}px`;
  const acc = adouci(entre(t, 1.5, 2.6));
  $("accroche").style.opacity = acc;
  $("accroche").style.transform = `translateY(${(1 - acc) * 12}px)`;

  // 2. Recherche : les champs se remplissent l'un après l'autre.
  const r = voile(t, 4.2, 9.4);
  $("recherche").style.opacity = r;
  const monte = adouci(entre(t, 4.0, 4.9));
  $("recherche").querySelector(".cadre").style.transform =
    `translate(-50%, -50%) translateY(${(1 - monte) * 26}px) scale(${0.975 + monte * 0.025})`;
  frappe("f-ville", "Dakar, Sénégal", entre(t, 5.0, 5.9));
  frappe("f-dates", "25 oct. – 1 nov. 2026", entre(t, 6.0, 7.1));
  frappe("f-pers", "2 voyageurs", entre(t, 7.2, 7.8));
  // Le bouton s'enfonce une fois, brièvement : on « clique ».
  const clic = t > 8.3 && t < 8.55 ? 1 : 0;
  $("f-cta").style.transform = `scale(${1 - clic * 0.035})`;
  $("f-cta").style.opacity = t > 8.3 ? 0.9 : 1;

  // 3. Résultats : les cartes arrivent en cascade.
  const res = voile(t, 10.0, 15.4);
  $("resultats").style.opacity = res;
  const cadreR = adouci(entre(t, 9.8, 10.6));
  $("resultats").querySelector(".cadre").style.transform =
    `translate(-50%, -50%) translateY(${(1 - cadreR) * 22}px)`;
  [...grille.children].forEach((c, i) => {
    const a = adouci(entre(t, 10.5 + i * 0.28, 11.4 + i * 0.28));
    c.style.opacity = a;
    c.style.transform = `translateY(${(1 - a) * 26}px)`;
  });

  // 4. Fiche : elle grandit depuis la carte, comme si on y entrait.
  const f = voile(t, 16.0, 21.4);
  $("fichep").style.opacity = f;
  const zoom = adouci(entre(t, 15.8, 16.8));
  $("fichep").querySelector(".cadre").style.transform =
    `translate(-50%, -50%) scale(${0.94 + zoom * 0.06})`;
  const prix = adouci(entre(t, 17.4, 18.4));
  $("fichep").querySelector(".fiche > div:last-child").style.opacity = prix;
  const sceau = adouci(entre(t, 19.0, 19.8));
  $("fichep").querySelector(".note").style.opacity = sceau;
  $("fichep").querySelector(".note").style.transform = `translateY(${(1 - sceau) * 10}px)`;

  // 5. Confirmation : la coche se dessine, une seule fois.
  const c = voile(t, 22.0, 26.4);
  $("confirmation").style.opacity = c;
  const trait = $("trait");
  const L = 46; // longueur approchée du tracé
  const dessin = adouci(entre(t, 22.3, 23.3));
  trait.style.strokeDasharray = L;
  trait.style.strokeDashoffset = L * (1 - dessin);
  const ct = adouci(entre(t, 23.2, 24.0));
  $("c-titre").style.opacity = ct;
  $("c-titre").style.transform = `translateY(${(1 - ct) * 10}px)`;
  const cs = adouci(entre(t, 23.6, 24.4));
  $("c-sous").style.opacity = cs;

  // 6. Fin.
  const fin = voile(t, 27.0, DUREE, 0.5);
  $("fin").style.opacity = fin;
  const fm = adouci(entre(t, 26.9, 27.9));
  $("fin").querySelector(".marque").style.opacity = fm;
  $("fin").querySelector(".marque").style.transform = `translateY(${(1 - fm) * 14}px)`;
  $("fin-txt").style.opacity = adouci(entre(t, 27.6, 28.5));
  // Léger travelling sur la photo : la ville respire derrière le texte.
  const z = entre(t, 26.5, DUREE);
  $("fin-img").style.transform = `scale(${1.06 + z * 0.05})`;
}

/** Écrit un texte caractère par caractère, avec un curseur tant qu'on tape. */
function frappe(id, texte, avancement) {
  const n = Math.round(borne(avancement) * texte.length);
  const el = document.getElementById(id);
  el.textContent = texte.slice(0, n);
  if (n > 0 && n < texte.length) {
    const c = document.createElement("i");
    c.className = "curseur";
    el.appendChild(c);
  }
}

// --- lecture ---------------------------------------------------------------
const demande = new URLSearchParams(location.search).get("t");
if (demande !== null) {
  rendre(parseFloat(demande));
  document.documentElement.dataset.pret = "1"; // repère pour la capture
} else {
  const depart = performance.now();
  (function boucle(maintenant) {
    rendre(((maintenant - depart) / 1000) % DUREE);
    requestAnimationFrame(boucle);
  })(depart);
}
