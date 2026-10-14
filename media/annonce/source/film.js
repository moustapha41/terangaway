/**
 * Annonce Teranga Way — parcours de la vraie plateforme.
 *
 * Les cinq étapes sont des captures de l'application telle qu'elle tourne :
 * accueil, résultats, fiche, demande, confirmation. Le film ne redessine rien,
 * il promène une fenêtre de 1280 × 720 sur ces pages, pose un curseur sur les
 * boutons — à leurs coordonnées réelles, mesurées dans le navigateur — et coupe
 * d'un écran au suivant.
 *
 * Comme pour la première version, tout est piloté par `rendre(t)` : la même
 * valeur de t donne toujours exactement la même image.
 */
const DUREE = 32;
const H = 720;

/** Cibles mesurées sur les pages réelles (coordonnées dans la page entière). */
const CIBLES = {
  accueil:   { x: 1052, y: 597 },   // Rechercher
  resultats: { x: 732,  y: 637 },   // Villa avec piscine, Ngor
  fiche:     { x: 1008, y: 890 },   // Demander ce logement
  demande:   { x: 640,  y: 872 },   // Continuer
};

/**
 * `points` : des étapes de défilement, en [avancement 0→1, position en pixels].
 *
 * On descend d'abord pour montrer la page, puis on **remonte** se poser sur le
 * bouton. C'est ce qu'une personne fait vraiment, et surtout : sans cela le
 * curseur cliquerait sur une cible sortie de l'écran par le haut.
 */
const ETAPES = [
  { id: "accueil",   entree: 1.6,  sortie: 8.6,
    points: [[0, 0], [0.52, 1700], [0.84, 240], [1, 240]],
    clic: 7.9 },
  { id: "resultats", entree: 9.0,  sortie: 15.0,
    points: [[0, 0], [0.48, 1060], [0.84, 300], [1, 300]],
    clic: 14.2 },
  { id: "fiche",     entree: 15.4, sortie: 21.4,
    points: [[0, 120], [0.48, 900], [0.84, 430], [1, 430]],
    clic: 20.6 },
  { id: "demande",   entree: 21.8, sortie: 27.0,
    points: [[0, 0], [0.55, 340], [0.85, 300], [1, 300]],
    clic: 26.2 },
  { id: "confirme",  entree: 27.4, sortie: 29.6,
    points: [[0, 0], [1, 150]] },
];

/** Position de défilement à un avancement donné, entre deux points de passage. */
function defilement(points, avance) {
  for (let i = 1; i < points.length; i++) {
    const [a0, y0] = points[i - 1];
    const [a1, y1] = points[i];
    if (avance <= a1 || i === points.length - 1) {
      const local = a1 === a0 ? 1 : borne((avance - a0) / (a1 - a0));
      return y0 + (y1 - y0) * douce(local);
    }
  }
  return points[points.length - 1][1];
}

const borne = (x) => Math.max(0, Math.min(1, x));
const entre = (t, a, b) => borne((t - a) / (b - a));
/** Départ et arrivée en douceur : le mouvement d'une page qu'on fait défiler. */
const douce = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Démarrage franc, arrivée douce. */
const sortie = (x) => 1 - Math.pow(1 - x, 3);

const $ = (id) => document.getElementById(id);
const FONDU = 0.34;

function rendre(t) {
  // --- carton d'ouverture -------------------------------------------------
  const ouv = t < 1.9 ? 1 - entre(t, 1.5, 1.9) : 0;
  $("ouverture").style.opacity = ouv;
  const m = sortie(entre(t, 0.15, 1.1));
  $("ouverture").querySelector(".marque").style.opacity = m;
  $("ouverture").querySelector(".marque").style.transform = `translateY(${(1 - m) * 14}px)`;
  $("filet").style.width = `${sortie(entre(t, 0.7, 1.5)) * 280}px`;
  $("o-sous").style.opacity = sortie(entre(t, 1.0, 1.7));

  // --- les cinq étapes ----------------------------------------------------
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
      // Défilement de la page : la fenêtre descend le long de la capture.
      const avance = entre(t, e.entree, e.sortie);
      const y = defilement(e.points, avance);
      el.querySelector("img").style.transform = `translateY(${-y}px)`;
      // Très léger rapprochement, pour que l'image ne soit jamais tout à fait figée.
      el.style.transform = `scale(${1 + entre(t, e.entree, e.sortie) * 0.012})`;
      if (o === 1) active = { e, y };
    }
  }

  // --- curseur et clic ----------------------------------------------------
  let curseurVisible = 0;
  if (active && active.e.clic) {
    const { e, y } = active;
    const cible = CIBLES[e.id];
    const approche = entre(t, e.clic - 1.0, e.clic);        // il arrive
    const apres = entre(t, e.clic + 0.12, e.clic + 0.45);   // il repart
    curseurVisible = sortie(approche) * (1 - apres);

    // Il vient du centre bas et se pose sur le bouton, dans la fenêtre courante.
    const cx = 640 + (cible.x - 640) * douce(approche);
    const cy = 620 + (cible.y - y - 620) * douce(approche);
    $("curseur").style.transform = `translate(${cx}px, ${cy}px)`;

    // L'onde du clic, une seule fois.
    const onde = entre(t, e.clic, e.clic + 0.5);
    if (onde > 0 && onde < 1) {
      $("onde").style.opacity = (1 - onde) * 0.9;
      $("onde").style.transform =
        `translate(${cible.x - 31}px, ${cible.y - y - 31}px) scale(${0.35 + onde * 0.9})`;
    } else {
      $("onde").style.opacity = 0;
    }
  } else {
    $("onde").style.opacity = 0;
  }
  $("curseur").style.opacity = curseurVisible;


  // --- carton de fin ------------------------------------------------------
  const f = entre(t, 29.2, 29.8);
  $("fin").style.opacity = f;
  const fm = sortie(entre(t, 29.5, 30.3));
  $("f-marque").style.opacity = fm;
  $("f-marque").style.transform = `translateY(${(1 - fm) * 12}px)`;
  $("f-sous").style.opacity = sortie(entre(t, 30.0, 30.7));
  $("f-url").style.opacity = sortie(entre(t, 30.6, 31.2));
}

const demande = new URLSearchParams(location.search).get("t");
if (demande !== null) {
  rendre(parseFloat(demande));
} else {
  const depart = performance.now();
  (function boucle(n) {
    rendre(((n - depart) / 1000) % DUREE);
    requestAnimationFrame(boucle);
  })(depart);
}
