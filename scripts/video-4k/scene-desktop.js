/**
 * Parcours complet, dans un navigateur, en 16:9 (1920×1080) :
 *
 *   1. On tape teranga-way.com dans la barre d'adresse.
 *   2. L'accueil s'affiche ; on défile jusqu'à « Voir tous les logements ».
 *   3. La liste ; on la parcourt, on choisit un logement.
 *   4. La fiche ; « Demander ce logement ».
 *   5. Le formulaire : nom, e-mail, téléphone, « Continuer ».
 *   6. La confirmation, puis la proposition de transport : « Oui, je veux une voiture ».
 *   7. La marque.
 *
 * Les pages sont les vraies, capturées sur la plateforme ; ce fichier ne fait que
 * les animer : fenêtre, barre d'adresse, défilement, curseur, caméra. Tout est
 * calculé à partir du seul temps `t`.
 */
const W = 1920, H = 1080;
const DUREE = 44.0;
const C = { nuit: "#001D35", jaune: "#F5BB45", vert: "#087443", vertClair: "#2FB574" };

/* ───────────── outils ───────────── */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const outCubic = (k) => 1 - Math.pow(1 - k, 3);
const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const inOutSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const outBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
/** Interpolation entre images clés [[t, v|[v…]], …]. */
function cle(t, kf, ease = inOut) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i][0]) {
      const k = ease(P(t, kf[i - 1][0], kf[i][0])), a = kf[i - 1][1], b = kf[i][1];
      return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], k)) : lerp(a, b, k);
    }
  }
  return kf[kf.length - 1][1];
}
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/* ───────────── la fenêtre du navigateur ───────────── */
// Le contenu fait 1800×916 : exactement la taille d'une capture (1440×733 css à 1,25).
const WX = 60, WY = 36, WWIDTH = 1800, BARRE = 92, CX = WX, CY = WY + BARRE, CH = 916;
const DPR = 1.25;
const LOGO = window.LOGO;
/** Coordonnées de page (px CSS) → canvas, à un défilement donné (px CSS). */
const cx = (x) => CX + x * DPR;
const cy = (y, sc = 0) => CY + (y - sc) * DPR;

/** Une page, à un défilement donné (px CSS) ; `alpha` pour les fondus. */
function page(ctx, nom, sc = 0, alpha = 1, dy = 0) {
  const pg = window.MANIFESTE.pages[nom]; if (!pg) return;
  sc = clamp(sc, 0, Math.max(0, pg.cssH - 733));
  ctx.save(); ctx.beginPath(); ctx.rect(CX, CY, WWIDTH, CH); ctx.clip();
  tuilesPage(ctx, nom, sc, 733, CX, CY + dy, WWIDTH, DPR, alpha);
  ctx.restore();
}

function url(ctx, texte, saisie, caret) {
  // pastille de l'adresse
  const x0 = WX + 150, w = WWIDTH - 150 - 120, y0 = WY + 46 + 6, h = 36;
  rr(ctx, x0, y0, w, h, 18); ctx.fillStyle = saisie ? "#FFFFFF" : "#EEF1F6"; ctx.fill();
  if (saisie) { ctx.strokeStyle = "#1A73E8"; ctx.lineWidth = 2.5; ctx.stroke(); }
  // cadenas
  ctx.save(); ctx.translate(x0 + 24, y0 + h / 2); ctx.strokeStyle = "#5F6368"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(0, -3, 5, Math.PI, 0); ctx.stroke(); rr(ctx, -7, -3, 14, 11, 2.5); ctx.fillStyle = "#5F6368"; ctx.fill(); ctx.restore();
  ctx.font = `400 17px ${FONT}`; ctx.textBaseline = "middle";
  const m = texte.match(/^([^/]+)(\/.*)?$/) || [null, texte, ""];
  const x = x0 + 48;
  ctx.fillStyle = "#1F2328"; ctx.fillText(m[1], x, y0 + h / 2 + 1);
  const dw = ctx.measureText(m[1]).width;
  if (m[2]) { ctx.fillStyle = "#6B7280"; ctx.fillText(m[2], x + dw, y0 + h / 2 + 1); }
  if (caret) { const tw = ctx.measureText(texte).width; ctx.fillStyle = "#1F2328"; ctx.fillRect(x + tw + 1, y0 + 8, 2, h - 16); }
}

function navigateur(ctx, o) {
  const { titre, favicon, texte, saisie, caret, charge, nouvelOnglet } = o;
  // ombre + corps
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 70; ctx.shadowOffsetY = 28;
  rr(ctx, WX, WY, WWIDTH, BARRE + CH, 20); ctx.fillStyle = "#DEE3EA"; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, WX, WY, WWIDTH, BARRE + CH, 20); ctx.clip();
  // rangée d'onglets
  ctx.fillStyle = "#DEE3EA"; ctx.fillRect(WX, WY, WWIDTH, 46);
  [["#FF5F57", 24], ["#FEBC2E", 48], ["#28C840", 72]].forEach(([c, dx]) => circle(ctx, WX + 12 + dx, WY + 23, 7, c));
  // onglet actif
  const tx = WX + 120, tw = 280;
  ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.moveTo(tx - 10, WY + 46); ctx.quadraticCurveTo(tx, WY + 46, tx, WY + 36); ctx.lineTo(tx, WY + 14); ctx.quadraticCurveTo(tx, WY + 6, tx + 10, WY + 6); ctx.lineTo(tx + tw - 10, WY + 6); ctx.quadraticCurveTo(tx + tw, WY + 6, tx + tw, WY + 14); ctx.lineTo(tx + tw, WY + 36); ctx.quadraticCurveTo(tx + tw, WY + 46, tx + tw + 10, WY + 46); ctx.closePath(); ctx.fill();
  // favicon (ou rond de chargement)
  if (charge > 0 && charge < 1) { ctx.save(); ctx.translate(tx + 26, WY + 26); ctx.rotate((o.t || 0) * 7); ctx.strokeStyle = "#1A73E8"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 1.4); ctx.stroke(); ctx.restore(); }
  else if (favicon) { circle(ctx, tx + 26, WY + 26, 9, C.jaune); ctx.fillStyle = C.nuit; ctx.font = `800 12px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("T", tx + 26, WY + 27); ctx.textAlign = "left"; }
  else { circle(ctx, tx + 26, WY + 26, 8, "#C4C9D1"); }
  ctx.font = `400 14px ${FONT}`; ctx.textBaseline = "middle"; ctx.fillStyle = "#1F2328"; ctx.fillText(titre, tx + 46, WY + 27);
  ctx.fillStyle = "#6B7280"; ctx.font = `400 18px ${FONT}`; ctx.fillText("×", tx + tw - 26, WY + 26);
  ctx.fillStyle = "#6B7280"; ctx.font = `300 24px ${FONT}`; ctx.fillText("+", tx + tw + 22, WY + 26);
  // barre d'outils
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(WX, WY + 46, WWIDTH, BARRE - 46);
  ctx.strokeStyle = "#5F6368"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  [[WX + 30, 1], [WX + 72, -1]].forEach(([x, s]) => { ctx.beginPath(); ctx.moveTo(x + 8 * s, WY + 69); ctx.lineTo(x - 8 * s, WY + 69); ctx.moveTo(x - 1 * s, WY + 61); ctx.lineTo(x - 9 * s, WY + 69); ctx.lineTo(x - 1 * s, WY + 77); ctx.stroke(); });
  ctx.beginPath(); ctx.arc(WX + 118, WY + 69, 8, 0.4, Math.PI * 2 - 0.5); ctx.stroke();
  url(ctx, texte, saisie, caret);
  // menu
  [-1, 0, 1].forEach((d) => circle(ctx, WX + WWIDTH - 40, WY + 69 + d * 7, 2.2, "#5F6368"));
  // barre de progression
  if (charge > 0 && charge < 1) { ctx.fillStyle = "#1A73E8"; ctx.fillRect(WX, WY + BARRE - 3, WWIDTH * charge, 3); }
  ctx.fillStyle = "#E3E6EB"; ctx.fillRect(WX, WY + BARRE - 1, WWIDTH, 1);
  ctx.restore();
}

/* ───────────── le curseur ───────────── */
function curseur(ctx, x, y, presse = 0, main = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.35 - presse * 0.16, 1.35 - presse * 0.16);
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(20, 33); ctx.lineTo(14, 21); ctx.lineTo(24, 21); ctx.closePath();
  ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent"; ctx.lineWidth = 2.2; ctx.strokeStyle = "#111"; ctx.stroke();
  ctx.restore();
}
function touche(ctx, x, y, t, t0) {
  for (let i = 0; i < 2; i++) {
    const k = P(t, t0 + i * 0.12, t0 + 0.7 + i * 0.12);
    if (k > 0 && k < 1) { ctx.strokeStyle = `rgba(245,187,69,${0.95 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(x, y, 12 + k * 80, 0, Math.PI * 2); ctx.stroke(); }
  }
  const k = P(t, t0, t0 + 0.45); if (k > 0 && k < 1) circle(ctx, x, y, 24 * (1 - k), `rgba(245,187,69,${0.5 * (1 - k)})`);
}
/** Anneau autour d'un élément (coordonnées de page css + défilement). */
function halo(ctx, r, sc, t, a, b, couleur = C.jaune, marge = 10) {
  const k = P(t, a, a + 0.35) * (1 - P(t, b - 0.3, b)); if (k <= 0) return;
  const pulse = 1 + Math.sin(t * 7) * 0.025;
  const x = cx(r.x + r.w / 2), y = cy(r.y + r.h / 2, sc), w = (r.w * DPR + marge * 2) * pulse, h = (r.h * DPR + marge * 2) * pulse;
  ctx.save(); ctx.globalAlpha *= k; ctx.strokeStyle = couleur; ctx.lineWidth = 5; ctx.shadowColor = couleur; ctx.shadowBlur = 26;
  rr(ctx, x - w / 2, y - h / 2, w, h, Math.min(h / 2, 26)); ctx.stroke(); ctx.restore();
}
function pression(ctx, r, sc, t, a, b) {
  const k = P(t, a, a + 0.12) * (1 - P(t, b, b + 0.25)); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= 0.18 * k; rr(ctx, cx(r.x) - 4, cy(r.y, sc) - 4, r.w * DPR + 8, r.h * DPR + 8, 18); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
}

/* ───────────── le décor ───────────── */
function fond(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#001D35"); g.addColorStop(0.55, "#0F2A47"); g.addColorStop(1, "#001628");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    const x = rnd(i) * W + Math.sin(t * 0.3 + i) * 40, y = (rnd(i + 5) * H + t * 12 * (0.5 + rnd(i + 2))) % H;
    glow(ctx, x, y, 90 + rnd(i + 8) * 150, i % 3 === 0 ? "rgba(245,187,69,0.55)" : "rgba(70,150,220,0.45)", 0.2);
  }
}

/* ───────────── le scénario ───────────── */
const R = window.RECTS;
const MODALE = window.MESURES;
// défilements (px CSS)
const SC_ACCUEIL = R.voirTout.y - 360;
const SC_LISTE = R.carte.y - 330;
const SC_FICHE = 300;
const SC_FORM = 493;
const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];

/** La saisie de l'adresse, lettre par lettre. */
const ADRESSE = "teranga-way.com";
function adresseSaisie(t) { return ADRESSE.slice(0, Math.floor(clamp((t - 2.5) / 1.35) * ADRESSE.length)); }

/** Quelle page, à quel défilement, et l'adresse affichée, selon l'instant. */
function etat(t) {
  // [début de la navigation, fin du chargement, nom de la page, adresse, titre]
  return t;
}

const PAGES = [
  { a: 4.0, nom: "accueil", url: "teranga-way.com", titre: "Teranga Way — Logements et transports JOJ 2026" },
  { a: 10.4, nom: "liste", url: "teranga-way.com/logements?tri=prix-croissant", titre: "Logements — Teranga Way" },
  { a: 16.6, nom: "fiche", url: "teranga-way.com/logements/appartement-piscine-sur-le-toit", titre: "Appartement deux chambres avec piscine sur le toit" },
  { a: 21.6, nom: "demande", url: "teranga-way.com/demande/l-029", titre: "Faire une demande — Teranga Way" },
  { a: 28.6, nom: "apres", url: "teranga-way.com/demande/confirmation", titre: "Demande enregistrée — Teranga Way" },
];
const CHARGE = 0.9, FONDU = 0.45;

const defileAccueil = (t) => cle(t, [[0, 0], [6.1, 0], [8.7, SC_ACCUEIL], [99, SC_ACCUEIL]]);
const defileListe = (t) => cle(t, [[0, 0], [11.6, 0], [12.4, 60], [15.4, SC_LISTE], [99, SC_LISTE]], inOutSine);
const defileFiche = (t) => cle(t, [[0, 0], [18.3, 0], [19.6, SC_FICHE], [99, SC_FICHE]]);
const defileForm = (t) => cle(t, [[0, 0], [25.9, 0], [27.3, SC_FORM], [99, SC_FORM]]);

function dessinerContenu(ctx, t) {
  // la page courante (la dernière dont le chargement est fini) et la précédente en fondu
  const i = PAGES.reduce((m, p, j) => (t >= p.a + CHARGE ? j : m), -1);
  const scDe = (nom, tt) => nom === "accueil" ? defileAccueil(tt) : nom === "liste" ? defileListe(tt) : nom === "fiche" ? defileFiche(tt) : nom === "demande" ? defileForm(tt) : 0;
  // fond blanc de l'onglet vide
  ctx.save(); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(CX, CY, WWIDTH, CH);
  if (i < 0) {
    // nouvel onglet : une barre de recherche discrète
    ctx.fillStyle = "#F4F6F9"; rr(ctx, CX + 600, CY + 380, 600, 56, 28); ctx.fill();
    ctx.fillStyle = "#9AA3AE"; ctx.font = `400 18px ${FONT}`; ctx.textBaseline = "middle"; ctx.fillText("Rechercher ou saisir une adresse", CX + 640, CY + 409);
  }
  ctx.restore();
  if (i >= 0) {
    const p = PAGES[i], k = P(t, p.a + CHARGE, p.a + CHARGE + FONDU);
    if (i > 0 && k < 1) page(ctx, PAGES[i - 1].nom === "demande" ? "remplie" : PAGES[i - 1].nom, scDe(PAGES[i - 1].nom, t), 1);
    if (p.nom === "demande") {
      const sc = defileForm(t);
      page(ctx, "demande", sc, k);
      // la saisie : chaque champ se remplit de gauche à droite
      [[R.nom, 22.6], [R.email, 23.4], [R.tel, 24.2]].forEach(([r, t0]) => {
        const kk = clamp((t - t0) / 0.7); if (kk <= 0) return;
        ctx.save(); ctx.beginPath(); ctx.rect(cx(r.x) - 30, cy(r.y - 14, sc), (r.w * DPR + 30) * outCubic(kk) + 30, (r.h + 28) * DPR); ctx.clip();
        page(ctx, "remplie", sc, 1); ctx.restore();
      });
    } else if (p.nom === "apres") {
      page(ctx, "apres", 0, k);
    } else page(ctx, p.nom, scDe(p.nom, t), k);
  }
  // la proposition de transport
  if (t >= 30.4) {
    const ouvre = outCubic(P(t, 30.4, 31.1)), ferme = inOut(P(t, 37.0, 37.6)), rep = inOut(P(t, 33.5, 34.0));
    const dim = ouvre * (1 - ferme);
    if (dim > 0) {
      const x0 = cx(R.oui.x - 24), x1 = cx(R.oui.x + R.oui.w + 24);
      // MODALE mesure le corps blanc de la fenêtre ; l'en-tête (titre, croix) est au-dessus.
      const y0e = cy(MODALE.e[0] - 84), y1e = cy(MODALE.e[1] + 16), y0f = cy(MODALE.f[0] - 84), y1f = cy(MODALE.f[1] + 16);
      ctx.save(); ctx.beginPath(); ctx.rect(CX, CY, WWIDTH, CH); ctx.clip();
      // le voile : même teinte que celle du site (bleu nuit à moitié opaque)
      ctx.fillStyle = `rgba(0,29,53,${0.5 * dim})`; ctx.fillRect(CX, CY, WWIDTH, CH);
      // la fenêtre surgit (échelle + fondu), puis change de contenu
      const sc = lerp(0.92, 1, ouvre) - ferme * 0.06;
      const cxm = (x0 + x1) / 2, cym = (y0e + y1e) / 2;
      ctx.translate(cxm, cym + (1 - ouvre) * 26); ctx.scale(sc, sc); ctx.translate(-cxm, -cym);
      ctx.globalAlpha *= dim;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0e, x1 - x0, y1e - y0e); ctx.clip(); ctx.globalAlpha *= 1 - rep; page(ctx, "popup", 0, 1); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0f, x1 - x0, y1f - y0f); ctx.clip(); ctx.globalAlpha *= rep; page(ctx, "oui", 0, 1); ctx.restore();
      ctx.restore();
    }
  }
}

/** Chemin du curseur en canvas, selon l'instant. */
function curseurPos(t) {
  const C0 = [WX + 1300, WY + 700];
  const kf = [
    [0.8, [1500, 760]], [1.9, [CX + 900, WY + 69]],              // vers la barre d'adresse
    [2.4, [CX + 900, WY + 69]],
    [4.6, [CX + 1050, CY + 470]],                                  // l'accueil
    [8.8, [CX + 1000, CY + 520]],
    [9.5, [cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]],
    [10.2, [cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]],
    [11.6, [CX + 1100, CY + 500]],                                 // la liste
    [15.7, [CX + 1000, CY + 560]],
    [16.3, [cx(mid(R.carte)[0]) + 20, cy(mid(R.carte)[1], SC_LISTE)]],
    [16.9, [cx(mid(R.carte)[0]) + 20, cy(mid(R.carte)[1], SC_LISTE)]],
    [18.0, [CX + 1300, CY + 400]],                                 // la fiche
    [19.8, [CX + 1400, CY + 560]],
    [20.9, [cx(mid(R.demander)[0]), cy(mid(R.demander)[1], SC_FICHE)]],
    [21.7, [cx(mid(R.demander)[0]), cy(mid(R.demander)[1], SC_FICHE)]],
    [22.6, [cx(R.nom.x + 140), cy(R.nom.y + 10, 0)]],              // le formulaire
    [23.4, [cx(R.email.x + 140), cy(R.email.y + 10, 0)]],
    [24.2, [cx(R.tel.x + 100), cy(R.tel.y + 10, 0)]],
    [25.2, [cx(R.semaine.x + 60), cy(R.semaine.y + 20, 0)]],
    [26.0, [cx(R.semaine.x + 60), cy(R.semaine.y + 20, 0)]],
    [28.2, [cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]],
    [28.9, [cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]],
    [30.6, [CX + 1250, CY + 560]],                                 // la proposition
    [33.0, [cx(mid(R.oui)[0]), cy(mid(R.oui)[1])]],
    [34.4, [cx(mid(R.oui)[0]), cy(mid(R.oui)[1])]],
    [35.4, [cx(R.vol.x + 120), cy(R.vol.y + 22)]],
    [36.5, [cx(mid(R.cont)[0]), cy(mid(R.cont)[1])]],
    [37.3, [cx(mid(R.cont)[0]), cy(mid(R.cont)[1])]],
    [38.2, [CX + 1450, CY + 650]],
  ];
  return cle(t, kf);
}
const CLICS = [1.9, 9.9, 16.4, 21.0, 28.4, 33.4, 36.8]; // l'adresse est validée par Entrée, non cliquée

/** Caméra : [t, zoom, fx, fy] en canvas. */
const CAMERA = [
  [0.0, [1.0, 960, 540]], [1.8, [1.0, 960, 540]],
  [2.0, [1.9, CX + 560, WY + 69]], [4.2, [1.9, CX + 560, WY + 69]], [5.0, [1.0, 960, 540]],
  [8.6, [1.0, 960, 540]], [9.4, [1.6, cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]], [10.3, [1.6, cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]], [11.0, [1.0, 960, 540]],
  [15.8, [1.0, 960, 540]], [16.3, [1.45, cx(mid(R.carte)[0]) + 120, cy(mid(R.carte)[1], SC_LISTE)]], [16.9, [1.45, cx(mid(R.carte)[0]) + 120, cy(mid(R.carte)[1], SC_LISTE)]], [17.6, [1.0, 960, 540]],
  [20.2, [1.0, 960, 540]], [20.8, [1.6, cx(mid(R.demander)[0]), cy(mid(R.demander)[1], SC_FICHE)]], [21.5, [1.6, cx(mid(R.demander)[0]), cy(mid(R.demander)[1], SC_FICHE)]], [22.2, [1.0, 960, 540]],
  [22.4, [1.35, CX + 760, CY + 430]], [26.0, [1.35, CX + 760, CY + 430]], [26.8, [1.0, 960, 540]],
  [28.0, [1.5, cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]], [29.0, [1.5, cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]], [29.8, [1.0, 960, 540]],
  [30.6, [1.0, 960, 540]], [31.6, [1.5, 960, CY + 400]], [37.4, [1.5, 960, CY + 400]], [38.4, [1.0, 960, 540]],
];

function dessiner(ctx, t) {
  t = clamp(t, 0, DUREE - 0.001);
  fond(ctx, t);
  const sortie = inOut(P(t, 39.4, 40.8));
  const entree = outCubic(P(t, 0, 1.2));
  let [z, fx, fy] = cle(t, CAMERA);
  // la caméra reste dans la fenêtre : jamais de vide sur les bords
  fx = clamp(fx, WX + 960 / z, WX + WWIDTH - 960 / z); fy = clamp(fy, WY + 540 / z, WY + BARRE + CH - 540 / z);
  ctx.save();
  const k = z * (0.9 + 0.1 * entree) * lerp(1, 0.6, sortie);
  ctx.translate(960, 540 + (1 - entree) * 120 - sortie * 360); ctx.scale(k, k); ctx.translate(-fx, -fy);
  ctx.globalAlpha = (0.2 + 0.8 * entree) * (1 - sortie);

  // la barre d'adresse
  const i = PAGES.reduce((m, p, j) => (t >= p.a ? j : m), -1);
  const nav = { t, titre: "Nouvel onglet", favicon: false, texte: "", saisie: false, caret: false, charge: 0 };
  if (t < 4.0) {
    const tape = adresseSaisie(t);
    nav.texte = tape; nav.saisie = t > 1.9; nav.caret = t > 1.9 && Math.floor(t * 2.2) % 2 === 0;
  } else {
    const p = PAGES[Math.max(i, 0)], dedans = P(t, p.a, p.a + CHARGE);
    nav.texte = p.url; nav.charge = dedans < 1 ? 0.05 + outCubic(dedans) * 0.95 : 0;
    nav.titre = dedans < 1 ? (i > 0 ? PAGES[i - 1].titre : "Nouvel onglet") : p.titre; nav.favicon = dedans >= 1 || i > 0;
  }
  navigateur(ctx, nav);
  dessinerContenu(ctx, t);

  // halos et pressions
  halo(ctx, R.voirTout, SC_ACCUEIL, t, 8.8, 10.0);
  pression(ctx, R.voirTout, SC_ACCUEIL, t, 9.9, 9.95);
  halo(ctx, R.carte, SC_LISTE, t, 15.6, 16.6, C.jaune, 14);
  halo(ctx, R.demander, SC_FICHE, t, 20.0, 21.2);
  pression(ctx, R.demander, SC_FICHE, t, 21.0, 21.05);
  halo(ctx, R.semaine, 0, t, 24.8, 26.2);
  halo(ctx, R.continuer, SC_FORM, t, 27.5, 28.6);
  pression(ctx, R.continuer, SC_FORM, t, 28.4, 28.45);
  if (t > 31.2 && t < 37.2) {
    halo(ctx, R.oui, 0, t, 32.2, 33.6);
    halo(ctx, R.vol, 0, t, 34.4, 35.8, C.vertClair);
    halo(ctx, R.cont, 0, t, 36.0, 37.0);
  }

  // curseur : visible une fois entré, jusqu'à la fin du parcours
  if (t > 0.9 && t < 39.0) {
    const [x, y] = curseurPos(t);
    const clic = CLICS.find((c) => Math.abs(t - c) < 0.4);
    const presse = CLICS.reduce((m, c) => Math.max(m, P(t, c, c + 0.12) * (1 - P(t, c + 0.12, c + 0.35))), 0);
    CLICS.forEach((c) => touche(ctx, x, y, t, c + 0.04));
    curseur(ctx, x, y, presse);
  }
  ctx.restore();

  // la marque
  if (sortie > 0) {
    const a = P(t, 40.2, 41.2), kk = outBack(P(t, 40.2, 41.4)), lk = inOut(P(t, 40.6, 42.2));
    ctx.save(); ctx.strokeStyle = C.jaune; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(960 - 360 * lk, 650); ctx.lineTo(960 + 360 * lk, 650); ctx.stroke();
    glow(ctx, 960, 650, 320, "rgba(245,187,69,0.7)", 0.35 * lk);
    if (LOGO && LOGO.complete) { const w = 820, h = w * LOGO.height / LOGO.width; ctx.globalAlpha = a; ctx.translate(960, 500); ctx.scale(kk, kk); ctx.drawImage(LOGO, -w / 2, -h / 2, w, h); }
    ctx.restore();
  }
}

/** Le temps réel → le temps du scénario : le défilement des pages longues se déroule plus lentement. */
const SEGMENTS = [[6.1, 8.7, 3.8], [11.6, 15.4, 7.0]]; // [début, fin dans le scénario, durée réelle]
function temps(tr) {
  let decalage = 0;
  for (const [a, b, reel] of SEGMENTS) {
    const debut = a + decalage, fin = debut + reel;
    if (tr < debut) return tr - decalage;
    if (tr < fin) return a + (tr - debut) * (b - a) / reel;
    decalage += reel - (b - a);
  }
  return tr - decalage;
}
const EXTRA = SEGMENTS.reduce((m, [a, b, reel]) => m + reel - (b - a), 0);
window.SCENE = { W, H, DUREE_REELLE: DUREE + EXTRA, dessiner, temps };
