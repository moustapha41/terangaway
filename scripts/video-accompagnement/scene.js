/**
 * Motion design de la plateforme : faire une demande, puis accepter le transport.
 *
 * Les écrans sont les vrais — captures de la plateforme, sur un téléphone de
 * 390 px — animés par-dessus : caméra qui s'approche, curseur qui touche, anneaux
 * autour de ce qui compte, pastilles de progression. Aucun sous-titre : l'interface
 * parle d'elle-même.
 *
 *   1. La fiche du logement : on touche « Demander ce logement ».
 *   2. Le formulaire : nom, e-mail, téléphone, durée du séjour, « Continuer ».
 *   3. La confirmation, puis la proposition de transport s'ouvre.
 *   4. « Oui, je veux une voiture » : c'est noté. On continue.
 *   5. La marque.
 *
 * Tout est dessiné à partir du seul temps `t` : la même fonction rend n'importe
 * quelle image, dans le navigateur comme à l'enregistrement.
 */
const W = 1920, H = 1080;
const DUREE = 26.0;
const C = { nuit: "#001D35", nuit2: "#0F2A47", jaune: "#F5BB45", vert: "#087443", vertClair: "#2FB574", blanc: "#FFFFFF" };

/* ───────────── outils ───────────── */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const outCubic = (k) => 1 - Math.pow(1 - k, 3);
const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const outBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const outElastic = (k) => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

/** Interpolation entre des images clés : [[t, v], …] ou [[t, [v…]], …], avec adoucissement. */
function cle(t, kf) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i][0]) {
      const k = inOut(P(t, kf[i - 1][0], kf[i][0])), a = kf[i - 1][1], b = kf[i][1];
      return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], k)) : lerp(a, b, k);
    }
  }
  return kf[kf.length - 1][1];
}

/* ───────────── le téléphone ───────────── */
const K = 1.12;                       // pixels du canvas par pixel CSS de l'écran
const SW = 390 * K, SH = 844 * K;     // écran
const SX = 960 - SW / 2 + 0, SY = 540 - SH / 2; // coin haut-gauche de l'écran
const px = (x) => SX + x * K, py = (y) => SY + y * K; // coordonnées d'écran → canvas

const IMG = {};
function charger(cb) {
  let reste = 0;
  for (const [k, src] of Object.entries(window.ECRANS)) { reste++; const im = new Image(); im.onload = () => { if (--reste === 0) cb(); }; im.src = src; IMG[k] = im; }
  LOGO = new Image(); LOGO.src = window.LOGO_URL; reste++; LOGO.onload = () => { if (--reste === 0) cb(); };
}
let LOGO = null;

/** Un écran, à une position de défilement, décalé de dx, entre y0 et y1 (coordonnées de page). */
function ecran(ctx, nom, o = {}) {
  const { scroll = 0, dx = 0, dy = 0, alpha = 1, y0 = 0, y1 = 99999, scale = 1 } = o;
  const im = IMG[nom]; if (!im || alpha <= 0) return;
  ctx.save();
  rr(ctx, SX, SY, SW, SH, 44 * K / 1.1); ctx.clip();
  // fenêtre de page visible, bornée à [y0, y1]
  const a = Math.max(y0, scroll), b = Math.min(y1, scroll + 844);
  if (b > a) {
    ctx.globalAlpha *= alpha;
    const sy = a * 2, sh = (b - a) * 2;
    ctx.drawImage(im, 0, sy, 780, Math.min(sh, im.height - sy), SX + dx, SY + (a - scroll) * K + dy, SW, (b - a) * K);
  }
  ctx.restore();
}

function telephone(ctx) {
  // ombre portée
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 80; ctx.shadowOffsetY = 40;
  rr(ctx, SX - 18, SY - 18, SW + 36, SH + 36, 78); ctx.fillStyle = "#0A0F16"; ctx.fill(); ctx.restore();
  rr(ctx, SX - 18, SY - 18, SW + 36, SH + 36, 78); ctx.strokeStyle = "#2A3340"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#1B232D"; ctx.fillRect(SX + SW + 15, SY + 160, 5, 90); ctx.fillRect(SX - 20, SY + 130, 5, 56); ctx.fillRect(SX - 20, SY + 200, 5, 56);
}
function ilot(ctx) { // îlot dynamique
  rr(ctx, 960 - 54, SY + 10, 108, 30, 15); ctx.fillStyle = "#04070B"; ctx.fill();
}

/* ───────────── le curseur et ses effets ───────────── */
function curseur(ctx, x, y, presse = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.5 - presse * 0.18, 1.5 - presse * 0.18);
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(20, 33); ctx.lineTo(14, 21); ctx.lineTo(24, 21); ctx.closePath();
  ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent"; ctx.lineWidth = 2.4; ctx.strokeStyle = C.nuit; ctx.stroke();
  ctx.restore();
}
function touche(ctx, x, y, t, t0) { // anneaux de pression
  for (let i = 0; i < 2; i++) {
    const k = P(t, t0 + i * 0.12, t0 + 0.7 + i * 0.12);
    if (k > 0 && k < 1) { ctx.strokeStyle = `rgba(245,187,69,${0.95 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(x, y, 14 + k * 90, 0, Math.PI * 2); ctx.stroke(); }
  }
  const k = P(t, t0, t0 + 0.5); if (k > 0 && k < 1) circle(ctx, x, y, 26 * (1 - k), `rgba(245,187,69,${0.45 * (1 - k)})`);
}
/** Anneau qui bat autour d'un élément (coordonnées d'écran en px CSS). */
function halo(ctx, r, t, a, b, couleur = C.jaune, marge = 8) {
  const k = P(t, a, a + 0.35) * (1 - P(t, b - 0.3, b)); if (k <= 0) return;
  const pulse = 1 + Math.sin(t * 7) * 0.03;
  ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = couleur; ctx.lineWidth = 5; ctx.shadowColor = couleur; ctx.shadowBlur = 24;
  const cx = px(r.x + r.w / 2), cy = py(r.y + r.h / 2), w = (r.w * K + marge * 2) * pulse, h = (r.h * K + marge * 2) * pulse;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, Math.min(h / 2, 30)); ctx.stroke(); ctx.restore();
}

/* ───────────── pictogrammes ───────────── */
function icone(ctx, nom, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (nom === "maison") { ctx.beginPath(); ctx.moveTo(-30, -2); ctx.lineTo(0, -30); ctx.lineTo(30, -2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(-22, 28); ctx.lineTo(22, 28); ctx.lineTo(22, -4); ctx.stroke(); ctx.strokeRect(-7, 10, 14, 18); }
  else if (nom === "calendrier") { rr(ctx, -30, -24, 60, 54, 9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(30, -6); ctx.moveTo(-16, -34); ctx.lineTo(-16, -18); ctx.moveTo(16, -34); ctx.lineTo(16, -18); ctx.stroke(); circle(ctx, -12, 8, 4.5, col); circle(ctx, 4, 8, 4.5, col); circle(ctx, -12, 20, 4.5, col); }
  else if (nom === "enveloppe") { rr(ctx, -32, -22, 64, 46, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-30, -18); ctx.lineTo(0, 6); ctx.lineTo(30, -18); ctx.stroke(); }
  else if (nom === "voiture") { ctx.beginPath(); ctx.moveTo(-34, 14); ctx.lineTo(-34, -4); ctx.quadraticCurveTo(-32, -10, -22, -10); ctx.lineTo(-14, -10); ctx.lineTo(-6, -26); ctx.lineTo(16, -26); ctx.lineTo(26, -10); ctx.quadraticCurveTo(34, -8, 34, 0); ctx.lineTo(34, 14); ctx.closePath(); ctx.stroke(); circle(ctx, -18, 16, 8, col); circle(ctx, 18, 16, 8, col); }
  else if (nom === "coche") { ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-18, 2); ctx.lineTo(-5, 15); ctx.lineTo(20, -14); ctx.stroke(); }
  ctx.restore();
}

/* ───────────── le décor ───────────── */
function fond(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  const k = P(t, 12, 16) - P(t, 19, 22);
  g.addColorStop(0, "#001D35"); g.addColorStop(0.55, k > 0 ? "#0B3B5A" : "#0F2A47"); g.addColorStop(1, "#001628");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) {
    const x = (rnd(i) * W + Math.sin(t * 0.3 + i) * 40), y = (rnd(i + 5) * H + t * 14 * (0.5 + rnd(i + 2))) % H;
    glow(ctx, x, y, 90 + rnd(i + 8) * 150, i % 3 === 0 ? "rgba(245,187,69,0.55)" : "rgba(70,150,220,0.45)", 0.22);
  }
  // grandes courbes
  ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(1640 - i * 40 + Math.sin(t * 0.4) * 10, 540, 380 + i * 70, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

/** Les quatre pastilles de progression, à droite : elles s'allument au fil de l'histoire. */
const ETAPES = [
  { nom: "maison", t: 3.1 }, { nom: "calendrier", t: 8.6 }, { nom: "enveloppe", t: 12.6 }, { nom: "voiture", t: 16.0 },
];
function progression(ctx, t, sortie) {
  const x = 1500, y0 = 310, pas = 150;
  ctx.save(); ctx.globalAlpha = 1 - sortie;
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pas * 3); ctx.stroke();
  // le trait jaune rejoint la pastille suivante entre deux moments
  const i = ETAPES.reduce((m, e, j) => (t >= e.t ? j : m), -1);
  const suite = i >= 0 && i < 3 ? P(t, ETAPES[i].t + 0.6, ETAPES[i + 1].t - 0.2) : 0;
  const longueur = i < 0 ? 0 : Math.min(3, i + suite);
  ctx.strokeStyle = C.jaune; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pas * longueur); ctx.stroke();
  ETAPES.forEach((e, j) => {
    const on = t >= e.t, cy = y0 + pas * j, k = P(t, e.t, e.t + 0.9);
    const sc = 1 + (on ? 0.28 * Math.sin(k * Math.PI) : 0);
    if (on) glow(ctx, x, cy, 110, "rgba(245,187,69,0.8)", 0.5 * (1 - P(t, e.t + 0.6, e.t + 2.2)));
    ctx.save(); ctx.translate(x, cy); ctx.scale(sc, sc);
    circle(ctx, 0, 0, 52, on ? C.jaune : "rgba(255,255,255,0.1)");
    ctx.lineWidth = 4; ctx.strokeStyle = on ? "#FFE3A0" : "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke();
    icone(ctx, e.nom, 0, 0, 0.9, on ? C.nuit : "rgba(255,255,255,0.45)");
    ctx.restore();
  });
  ctx.restore();
}

/** Grande pastille qui jaillit près du téléphone à chaque moment clé. */
function pastille(ctx, t, t0, nom, x, y, vert = false) {
  const k = outElastic(P(t, t0, t0 + 0.9)) * (1 - inOut(P(t, t0 + 1.7, t0 + 2.3)));
  if (k <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  glow(ctx, 0, 0, 200, vert ? "rgba(47,181,116,0.9)" : "rgba(245,187,69,0.9)", 0.55);
  circle(ctx, 0, 0, 86, vert ? C.vert : C.jaune); circle(ctx, 0, 0, 74, vert ? "#0B8E54" : "#FFD27A");
  icone(ctx, nom, 0, 0, 1.55, vert ? "#fff" : C.nuit);
  ctx.restore();
}

/* ───────────── la caméra ───────────── */
const CAM = [
  [0.0, [1.0, 195, 422]], [1.0, [1.0, 195, 422]],
  [2.2, [1.7, 195, 640]], [3.9, [1.7, 195, 640]], [4.5, [1.0, 195, 422]],
  [5.0, [1.5, 195, 410]], [7.2, [1.5, 195, 520]],
  [7.9, [1.15, 195, 422]], [8.9, [1.6, 255, 390]], [10.0, [1.6, 255, 390]],
  [10.6, [1.5, 195, 650]], [11.8, [1.5, 195, 650]], [12.4, [1.0, 195, 422]],
  [14.6, [1.0, 195, 422]], [15.6, [1.4, 195, 600]], [17.6, [1.4, 195, 600]],
  [18.4, [1.45, 195, 640]], [20.2, [1.45, 195, 640]], [20.9, [1.0, 195, 422]],
  [21.2, [1.0, 195, 422]],
];

/* ───────────── le scénario ───────────── */
const R = {
  btnFiche: { x: 30, y: 760, w: 265, h: 48 },
  nom: { x: 73, y: 388.6, w: 272, h: 24 }, email: { x: 73, y: 474.1, w: 272, h: 24 }, tel: { x: 185, y: 559.6, w: 160, h: 24 },
  semaine: { x: 199, y: 699.1, w: 161, h: 52 }, continuer: { x: 30, y: 1025.4, w: 330, h: 48 },
  oui: { x: 20, y: 674, w: 350, h: 52 }, vol: { x: 36, y: 612, w: 256, h: 44 }, fermer: { x: 20, y: 741, w: 350, h: 52 },
};
const ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const SCROLL_MAX = 363;
/** Défilement du formulaire : en haut, puis vers les durées, puis vers le bouton. */
const defile = (t) => cle(t, [[0, 0], [7.6, 0], [8.6, 150], [10.1, 150], [10.8, SCROLL_MAX], [99, SCROLL_MAX]]);

/** Le chemin du curseur : [temps, x, y] en pixels CSS d'écran (coordonnées de fenêtre). */
function cheminCurseur(t) {
  // fiche → bouton « Demander ce logement » (fenêtre : le bouton est fixé en bas)
  const kf = [
    [0.0, [470, 900]], [2.0, [470, 900]],
    [2.9, ctr(R.btnFiche).map((v, i) => (i ? v + 0 : v))],
    [3.5, ctr(R.btnFiche)],
    // formulaire (fenêtre : y de page − défilement)
    [4.9, [300, 640]],
    [5.4, [ctr(R.nom)[0] + 40, ctr(R.nom)[1]]],
    [6.1, [ctr(R.email)[0] + 40, ctr(R.email)[1]]],
    [6.8, [ctr(R.tel)[0] + 20, ctr(R.tel)[1]]],
    [8.2, [300, 520]],
  ];
  return cle(t, kf);
}

function dessiner(ctx, t) {
  t = clamp(t, 0, DUREE - 0.001);
  fond(ctx, t);
  const sortie = inOut(P(t, 21.4, 22.6));
  const [z, fx, fy] = cle(t, CAM);
  const entree = outCubic(P(t, 0, 1.1));
  const zoomFin = lerp(1, 0.55, sortie);
  ctx.save();
  // caméra : on se place sur le point visé, avec un léger balancement
  ctx.translate(960, 540 + (1 - entree) * 600 - sortie * 500);
  ctx.scale(z * zoomFin * (0.9 + 0.1 * entree), z * zoomFin * (0.9 + 0.1 * entree));
  ctx.translate(-px(fx), -py(fy));
  ctx.globalAlpha = 1 - sortie;
  telephone(ctx);

  /* ── l'écran : quatre phases ── */
  const pousse1 = inOut(P(t, 3.7, 4.5));        // fiche → formulaire
  const pousse2 = inOut(P(t, 11.7, 12.5));      // formulaire → confirmation
  const sheetE = window.FEUILLE.e - 26, sheetF = window.FEUILLE.f - 26;

  if (t < 4.5) {
    ecran(ctx, "a", { dx: -pousse1 * SW * 0.3 });
    if (pousse1 > 0) { ecran(ctx, "c", { dx: (1 - pousse1) * SW }); }
    // pression du bouton
    const pr = P(t, 3.15, 3.3) * (1 - P(t, 3.3, 3.55));
    if (pr > 0) { ctx.save(); ctx.globalAlpha = 0.18 * pr; rr(ctx, px(R.btnFiche.x), py(R.btnFiche.y), R.btnFiche.w * K, R.btnFiche.h * K, 24 * K); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); }
    halo(ctx, R.btnFiche, t, 1.8, 3.6);
  } else if (t < 12.5) {
    const sc = defile(t);
    ecran(ctx, "c", { scroll: sc, dx: -pousse2 * SW * 0.3 });
    // la saisie : chaque champ se remplit, de gauche à droite
    [[R.nom, 5.2], [R.email, 5.9], [R.tel, 6.6]].forEach(([r, t0]) => {
      const k = outCubic(P(t, t0, t0 + 0.55)); if (k <= 0) return;
      ecran(ctx, "d", { scroll: sc, y0: r.y - 10, y1: r.y + r.h + 10, dx: -pousse2 * SW * 0.3, alpha: k });
    });
    // chips : l'anneau sur « 1 semaine »
    halo(ctx, { ...R.semaine, y: R.semaine.y - sc }, t, 8.8, 10.2);
    halo(ctx, { ...R.continuer, y: R.continuer.y - sc }, t, 11.0, 11.9);
    const pr = P(t, 11.15, 11.3) * (1 - P(t, 11.3, 11.55));
    if (pr > 0) { ctx.save(); ctx.globalAlpha = 0.18 * pr; rr(ctx, px(R.continuer.x), py(R.continuer.y - sc), R.continuer.w * K, R.continuer.h * K, 24 * K); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); }
    if (pousse2 > 0) { ecran(ctx, "g", { dx: (1 - pousse2) * SW }); }
  } else {
    // la confirmation, puis la proposition
    ecran(ctx, "g");
    const monte = outCubic(P(t, 13.6, 14.4));
    const ferme = inOut(P(t, 19.3, 20.1));
    const reponse = inOut(P(t, 15.9, 16.4));
    if (t < 13.6) { /* page seule */ }
    else if (ferme < 1) {
      const dim = (monte) * (1 - ferme);
      const base = reponse < 0.5 ? "e" : "f";
      const haut = base === "e" ? sheetE : sheetF;
      // l'arrière-plan s'assombrit
      ecran(ctx, "e", { alpha: dim, y1: sheetE });
      // la feuille monte, puis redescend
      const dy = ((1 - monte) + ferme) * (844 - sheetE + 40) * K;
      ecran(ctx, "e", { y0: sheetE, dy, alpha: 1 - reponse });
      ecran(ctx, "f", { y0: sheetF, dy, alpha: reponse });
    }
    // pression sur « Oui » puis « Continuer »
    [[R.oui, 15.55, 15.75], [R.fermer, 19.0, 19.2]].forEach(([r, a, b]) => {
      const pr = P(t, a, b) * (1 - P(t, b, b + 0.25)); if (pr <= 0) return;
      ctx.save(); ctx.globalAlpha = 0.16 * pr; rr(ctx, px(r.x), py(r.y), r.w * K, r.h * K, 26 * K); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
    });
    halo(ctx, R.oui, t, 14.7, 15.8);
    halo(ctx, R.vol, t, 17.2, 18.4, C.vertClair);
    halo(ctx, R.fermer, t, 18.5, 19.4);
  }
  ilot(ctx);

  /* ── curseur ── */
  let cx, cy, presse = 0, visible = true;
  if (t < 4.5) { [cx, cy] = cheminCurseur(t); presse = P(t, 3.15, 3.3) * (1 - P(t, 3.3, 3.5)); visible = t > 2.0 && t < 4.0; }
  else if (t < 12.4) {
    const sc = defile(t);
    const [x, y] = cle(t, [
      [4.5, [330, 700]], [5.2, [ctr(R.nom)[0] + 60, ctr(R.nom)[1] - defile(5.2)]], [5.9, [ctr(R.email)[0] + 60, ctr(R.email)[1] - defile(5.9)]], [6.6, [ctr(R.tel)[0] + 30, ctr(R.tel)[1] - defile(6.6)]],
      [7.6, [300, 520]], [8.8, [ctr(R.semaine)[0], ctr(R.semaine)[1] - 150]], [10.0, [ctr(R.semaine)[0], ctr(R.semaine)[1] - 150]],
      [11.05, [ctr(R.continuer)[0], ctr(R.continuer)[1] - SCROLL_MAX]],
    ]);
    cx = x; cy = y; presse = P(t, 11.15, 11.3) * (1 - P(t, 11.3, 11.5)); visible = t > 4.6 && t < 11.9;
  } else {
    [cx, cy] = cle(t, [
      [14.4, [330, 800]], [15.5, ctr(R.oui)], [16.6, ctr(R.oui)], [17.4, [ctr(R.vol)[0] + 20, ctr(R.vol)[1]]], [18.8, ctr(R.fermer)], [19.2, ctr(R.fermer)], [19.6, [300, 600]],
    ]);
    presse = Math.max(P(t, 15.55, 15.7) * (1 - P(t, 15.7, 15.9)), P(t, 19.0, 19.15) * (1 - P(t, 19.15, 19.35))); visible = t > 14.4 && t < 19.8;
  }
  if (visible) {
    const ex = px(cx), ey = py(cy);
    if (t < 4.5) touche(ctx, ex, ey, t, 3.2);
    else if (t < 12.4) touche(ctx, ex, ey, t, 11.2);
    else { touche(ctx, ex, ey, t, 15.6); touche(ctx, ex, ey, t, 19.05); }
    curseur(ctx, ex, ey, presse);
  }
  ctx.restore();

  /* ── pastilles ── */
  ctx.save(); ctx.globalAlpha = 1 - sortie;
  pastille(ctx, t, 3.2, "maison", 470, 400);
  pastille(ctx, t, 8.7, "calendrier", 470, 520);
  pastille(ctx, t, 12.7, "enveloppe", 470, 400);
  pastille(ctx, t, 16.2, "voiture", 470, 540, true);
  ctx.restore();
  progression(ctx, t, sortie);

  /* ── la marque ── */
  if (sortie > 0) {
    const a = P(t, 22.0, 23.0), k = outBack(P(t, 22.0, 23.2));
    const lk = inOut(P(t, 22.4, 24.0));
    ctx.strokeStyle = C.jaune; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(960 - 360 * lk, 650); ctx.lineTo(960 + 360 * lk, 650); ctx.stroke();
    glow(ctx, 960, 650, 320, "rgba(245,187,69,0.7)", 0.35 * lk);
    if (LOGO && LOGO.complete) { const w = 820, h = w * LOGO.height / LOGO.width; ctx.save(); ctx.globalAlpha = a; ctx.translate(960, 500); ctx.scale(k, k); ctx.drawImage(LOGO, -w / 2, -h / 2, w, h); ctx.restore(); }
  }
}
