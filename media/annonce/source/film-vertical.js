/**
 * Annonce verticale — même parcours, mise en page mobile.
 *
 * Deux formats sortent de ce fichier : `?format=9x16` (1080 × 1920) et
 * `?format=1x1` (1080 × 1080). On ne recadre pas le film paysage : on filme
 * la **version mobile du site**, qui est celle qu'on regarde sur un téléphone.
 *
 * Les captures mobiles sont en densité 2, donc 1080 de large : la scène fait
 * exactement la taille de la vidéo, sans mise à l'échelle. Les coordonnées
 * mesurées dans le navigateur sont en pixels CSS, on les double une fois pour
 * toutes — une transformation sur le conteneur serait plus élégante, mais elle
 * coupait la scène à mi-hauteur et ne valait pas qu'on s'acharne.
 *
 * Comme pour le format paysage, `rendre(t)` est la seule source de vérité :
 * la même valeur de t donne toujours exactement la même image.
 */
const LARGEUR = 1080;
const FORMATS = { "9x16": { hauteur: 1920 }, "1x1": { hauteur: 1080 } };

const parametres = new URLSearchParams(location.search);
const format = FORMATS[parametres.get("format")] ?? FORMATS["9x16"];
const H = format.hauteur;
const DUREE = 30;

/** Cibles mesurées sur les pages réelles, en pixels CSS, doublées pour la densité 2. */
const CIBLES = {
  accueil: 858 * 2,    // Rechercher
  resultats: 1441 * 2, // la carte « Villa avec piscine, Ngor »
  demande: 872 * 2,    // Continuer
  // La fiche n'est pas là : son bouton vit dans la barre fixe, pas dans la page.
};

/**
 * `pointeDeFin` place la cible au centre de l'écran, quel que soit le format.
 * C'est calculé, pas réglé à la main : un même chiffre ne peut pas convenir
 * à un 9:16 et à un carré.
 */
const centrer = (cible) => Math.max(0, Math.round(cible - H / 2));

/**
 * `fixe` : la barre qui colle au bas de l'écran sur cette page. La fiche
 * remplace la navigation par sa barre de réservation — « un seul élément
 * fixe » (§B.6) — et c'est ce bouton-là qu'on vient cliquer.
 *
 * `cibleFixe` : hauteur du bouton au-dessus du bas du cadre. Le repère ne
 * défile pas avec la page, il est posé sur le cadre.
 */
const ETAPES = [
  { id: "accueil",   entree: 1.5,  sortie: 8.2,  explore: 3200, clic: 7.6,
    fixe: "ecrans-mobile/fixe-accueil.png", hauteurFixe: 128 },
  { id: "resultats", entree: 8.6,  sortie: 14.4, explore: 3800, clic: 13.8,
    fixe: "ecrans-mobile/fixe-accueil.png", hauteurFixe: 128 },
  { id: "fiche",     entree: 14.8, sortie: 20.8, depart: 300, explore: 2100, repos: 1400, clic: 20.1,
    fixe: "ecrans-mobile/fixe-fiche.png", hauteurFixe: 300, cibleFixe: 110 },
  { id: "demande",   entree: 21.2, sortie: 26.4, explore: 1800, clic: 25.7,
    fixe: "ecrans-mobile/fixe-accueil.png", hauteurFixe: 128 },
  { id: "confirme",  entree: 26.8, sortie: 29.0, explore: 560, repos: 420,
    fixe: "ecrans-mobile/fixe-accueil.png", hauteurFixe: 128 },
];

const borne = (x) => Math.max(0, Math.min(1, x));
const entre = (t, a, b) => borne((t - a) / (b - a));
const douce = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const sortie = (x) => 1 - Math.pow(1 - x, 3);
const $ = (id) => document.getElementById(id);
const FONDU = 0.32;

$("scene").style.width = `${LARGEUR}px`;
$("scene").style.height = `${H}px`;
for (const img of document.querySelectorAll(".etape img")) img.style.width = `${LARGEUR}px`;

/** Le défilement d'une étape : on descend explorer, puis on remonte sur la cible. */
function defilement(e, avance) {
  const depart = e.depart ?? 0;
  // Où la page se repose à la fin du plan : sur sa cible si elle en a une dans
  // le flux, sinon là où on veut la laisser — pas au point le plus bas exploré.
  const fin = CIBLES[e.id] !== undefined ? centrer(CIBLES[e.id]) : (e.repos ?? e.explore);
  const points = [[0, depart], [0.5, e.explore], [0.84, fin], [1, fin]];
  for (let i = 1; i < points.length; i++) {
    const [a0, y0] = points[i - 1];
    const [a1, y1] = points[i];
    if (avance <= a1 || i === points.length - 1) {
      const local = a1 === a0 ? 1 : borne((avance - a0) / (a1 - a0));
      return y0 + (y1 - y0) * douce(local);
    }
  }
  return fin;
}

function rendre(t) {
  const ouv = t < 1.8 ? 1 - entre(t, 1.4, 1.8) : 0;
  $("ouverture").style.opacity = ouv;
  const m = sortie(entre(t, 0.15, 1.0));
  $("ouverture").querySelector("img").style.opacity = m;
  $("ouverture").querySelector("img").style.transform = `translateY(${(1 - m) * 12}px)`;
  $("filet").style.width = `${sortie(entre(t, 0.7, 1.4)) * 140}px`;

  let active = null;
  for (const e of ETAPES) {
    const el = $(`e-${e.id}`);
    let o = 0;
    if (t >= e.entree - FONDU && t <= e.sortie + FONDU) {
      o = t < e.entree ? entre(t, e.entree - FONDU, e.entree)
        : t > e.sortie ? 1 - entre(t, e.sortie, e.sortie + FONDU)
        : 1;
    }
    el.style.opacity = o;
    if (o > 0) {
      const avance = entre(t, e.entree, e.sortie);
      const y = defilement(e, avance);
      el.querySelector("img").style.transform = `translateY(${-y}px)`;
      if (o === 1) active = { e, y };
    }
  }

  // La barre fixe suit l'étape active, posée sur le bas du cadre.
  const barre = $("barre-fixe");
  if (active) {
    barre.src = active.e.fixe;
    barre.style.opacity = 1;
  } else {
    barre.style.opacity = 0;
  }

  let visible = 0;
  if (active && active.e.clic) {
    const { e, y } = active;
    // Cible dans la page, ou dans la barre fixe quand c'est elle qui porte
    // le bouton — la fiche est dans ce cas.
    const cibleY =
      e.cibleFixe !== undefined ? y + H - e.cibleFixe : CIBLES[e.id];
    const approche = entre(t, e.clic - 0.9, e.clic);
    const apres = entre(t, e.clic + 0.12, e.clic + 0.42);
    visible = sortie(approche) * (1 - apres);
    const cx = LARGEUR / 2 + (LARGEUR * 0.56 - LARGEUR / 2) * douce(approche);
    const cy = H * 0.86 + (cibleY - y - H * 0.86) * douce(approche);
    $("curseur").style.transform = `translate(${cx}px, ${cy}px)`;

    const onde = entre(t, e.clic, e.clic + 0.45);
    if (onde > 0 && onde < 1) {
      $("onde").style.opacity = (1 - onde) * 0.9;
      $("onde").style.transform =
        `translate(${LARGEUR * 0.56 - 27}px, ${cibleY - y - 27}px) scale(${0.35 + onde * 0.8})`;
    } else $("onde").style.opacity = 0;
  } else $("onde").style.opacity = 0;
  $("curseur").style.opacity = visible;

  const f = entre(t, 28.7, 29.3);
  $("fin").style.opacity = f;
  const fm = sortie(entre(t, 28.9, 29.6));
  $("f-logo").style.opacity = fm;
  $("f-logo").style.transform = `translateY(${(1 - fm) * 10}px)`;
  $("f-sous").style.opacity = sortie(entre(t, 29.2, 29.8));
  $("f-url").style.opacity = sortie(entre(t, 29.5, 30));
}

const demande = parametres.get("t");
if (demande !== null) rendre(parseFloat(demande));
else {
  const depart = performance.now();
  (function boucle(n) {
    rendre(((n - depart) / 1000) % DUREE);
    requestAnimationFrame(boucle);
  })(depart);
}
