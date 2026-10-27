/**
 * Le même parcours, en 9:16 (1080×1920), dans un navigateur de téléphone :
 * l'adresse tapée, l'accueil, « Voir tous les logements », le choix d'un
 * logement, la demande, puis « Oui, je veux une voiture ».
 *
 * Les pages sont les vraies, capturées sur la plateforme à 390 px de large ;
 * ce fichier les anime : barre d'adresse, défilement (avec un flou de
 * mouvement quand il est rapide), doigt, caméra. Tout est calculé à partir du
 * seul temps `t`.
 */
const W = 1080, H = 1920;
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

/* ───────────── le téléphone ───────────── */
const K = 1080 / 390;                // px du canvas par px CSS
const CY = 160, CH = 1650;           // zone de la page : sous la barre d'adresse, au-dessus de la barre du bas
const LOGO = window.LOGO;
const cx = (x) => x * K;
const cy = (y, sc = 0) => CY + (y - sc) * K;

/** Une page à un défilement donné (px CSS) ; un flou de mouvement quand le défilement est rapide. */
function page(ctx, nom, sc = 0, alpha = 1, vitesse = 0) {
  const pg = window.MANIFESTE.pages[nom]; if (!pg || alpha <= 0) return;
  sc = clamp(sc, 0, Math.max(0, pg.cssH - 596));
  ctx.save(); ctx.beginPath(); ctx.rect(0, CY, W, CH); ctx.clip();
  const flou = clamp((Math.abs(vitesse) - 1800) / 1500);
  if (flou > 0.05) { const n = 9, etale = vitesse * 0.014 * flou / K; for (let i = 0; i < n; i++) tuilesPage(ctx, nom, sc - etale * (i / (n - 1) - 0.5), 596, 0, CY, W, K, alpha / (i + 1)); }
  else tuilesPage(ctx, nom, sc, 596, 0, CY, W, K, alpha);
  ctx.restore();
}

function barres(ctx, o) {
  const { texte, saisie, caret, charge, titre } = o;
  // haut
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, CY);
  ctx.fillStyle = "#111"; ctx.font = `600 30px ${FONT}`; ctx.textBaseline = "middle"; ctx.fillText("9:41", 56, 30);
  ctx.fillStyle = "#111"; for (let i = 0; i < 4; i++) ctx.fillRect(800 + i * 12, 38 - i * 5, 7, 6 + i * 5);
  rr(ctx, 905, 20, 54, 26, 7); ctx.strokeStyle = "#111"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillRect(909, 24, 40, 18); ctx.fillRect(961, 28, 4, 10);
  // pastille d'adresse
  const x0 = 36, y0 = 72, w = W - 72, h = 76;
  rr(ctx, x0, y0, w, h, 38); ctx.fillStyle = saisie ? "#FFFFFF" : "#EEF1F6"; ctx.fill();
  if (saisie) { ctx.strokeStyle = "#1A73E8"; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.save(); ctx.translate(x0 + 44, y0 + h / 2); ctx.strokeStyle = "#5F6368"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(0, -5, 8, Math.PI, 0); ctx.stroke(); rr(ctx, -11, -4, 22, 17, 4); ctx.fillStyle = "#5F6368"; ctx.fill(); ctx.restore();
  ctx.font = `400 30px ${FONT}`; ctx.textBaseline = "middle";
  const m = texte.match(/^([^/]+)(\/.*)?$/) || [null, texte, ""];
  const x = x0 + 84; const dispo = w - 84 - 70;
  let site = m[1], chemin = m[2] || "";
  // le chemin se raccourcit s'il déborde
  while (ctx.measureText(site + chemin).width > dispo && chemin.length > 4) chemin = chemin.slice(0, -2);
  if (chemin !== (m[2] || "")) chemin += "…";
  ctx.fillStyle = "#1F2328"; ctx.fillText(site, x, y0 + h / 2 + 2);
  const dw = ctx.measureText(site).width;
  if (chemin) { ctx.fillStyle = "#6B7280"; ctx.fillText(chemin, x + dw, y0 + h / 2 + 2); }
  if (caret) { const tw = ctx.measureText(texte).width; ctx.fillStyle = "#1F2328"; ctx.fillRect(x + tw + 2, y0 + 16, 3, h - 32); }
  ctx.strokeStyle = "#5F6368"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(x0 + w - 44, y0 + h / 2, 14, 0.5, Math.PI * 2 - 0.4); ctx.stroke();
  // chargement
  if (charge > 0 && charge < 1) { ctx.fillStyle = "#1A73E8"; ctx.fillRect(0, CY - 6, W * charge, 6); }
  ctx.fillStyle = "#E3E6EB"; ctx.fillRect(0, CY - 1, W, 1);
  // bas
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, CY + CH, W, H - CY - CH);
  ctx.fillStyle = "#E3E6EB"; ctx.fillRect(0, CY + CH, W, 1);
  ctx.strokeStyle = "#5F6368"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const by = CY + CH + 52;
  ctx.beginPath(); ctx.moveTo(120, by); ctx.lineTo(90, by); ctx.moveTo(100, by - 14); ctx.lineTo(86, by); ctx.lineTo(100, by + 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(300, by); ctx.lineTo(330, by); ctx.moveTo(320, by - 14); ctx.lineTo(334, by); ctx.lineTo(320, by + 14); ctx.stroke();
  rr(ctx, 520, by - 8, 40, 30, 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(540, by - 30); ctx.lineTo(540, by + 6); ctx.moveTo(526, by - 18); ctx.lineTo(540, by - 32); ctx.lineTo(554, by - 18); ctx.stroke();
  rr(ctx, 738, by - 18, 40, 36, 8); ctx.stroke(); ctx.font = `700 20px ${FONT}`; ctx.fillStyle = "#5F6368"; ctx.textAlign = "center"; ctx.fillText("1", 758, by + 1); ctx.textAlign = "left";
  [-1, 0, 1].forEach((d) => circle(ctx, 960 + d * 14, by, 3.5, "#5F6368"));
  ctx.fillStyle = "#111"; rr(ctx, 400, H - 18, 280, 8, 4); ctx.fill(); // barre d'accueil
}

/* ───────────── le doigt ───────────── */
function doigt(ctx, x, y, presse = 0) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  circle(ctx, 0, 0, 44 - presse * 10, "rgba(255,255,255,0.55)"); ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 44 - presse * 10, 0, Math.PI * 2); ctx.stroke();
  circle(ctx, 0, 0, 14, "rgba(0,29,53,0.35)");
  ctx.restore();
}
function touche(ctx, x, y, t, t0) {
  for (let i = 0; i < 2; i++) {
    const k = P(t, t0 + i * 0.12, t0 + 0.7 + i * 0.12);
    if (k > 0 && k < 1) { ctx.strokeStyle = `rgba(245,187,69,${0.95 * (1 - k)})`; ctx.lineWidth = 8 * (1 - k) + 1; ctx.beginPath(); ctx.arc(x, y, 30 + k * 160, 0, Math.PI * 2); ctx.stroke(); }
  }
  const k = P(t, t0, t0 + 0.45); if (k > 0 && k < 1) circle(ctx, x, y, 50 * (1 - k), `rgba(245,187,69,${0.5 * (1 - k)})`);
}
function halo(ctx, r, sc, t, a, b, couleur = C.jaune, marge = 14) {
  const k = P(t, a, a + 0.35) * (1 - P(t, b - 0.3, b)); if (k <= 0) return;
  const pulse = 1 + Math.sin(t * 7) * 0.025;
  const x = cx(r.x + r.w / 2), y = cy(r.y + r.h / 2, sc), w = (r.w * K + marge * 2) * pulse, h = (r.h * K + marge * 2) * pulse;
  ctx.save(); ctx.globalAlpha *= k; ctx.strokeStyle = couleur; ctx.lineWidth = 7; ctx.shadowColor = couleur; ctx.shadowBlur = 30;
  rr(ctx, x - w / 2, y - h / 2, w, h, Math.min(h / 2, 40)); ctx.stroke(); ctx.restore();
}
function pression(ctx, r, sc, t, a, b) {
  const k = P(t, a, a + 0.12) * (1 - P(t, b, b + 0.25)); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= 0.18 * k; rr(ctx, cx(r.x) - 6, cy(r.y, sc) - 6, r.w * K + 12, r.h * K + 12, 30); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
}

/* ───────────── le scénario ───────────── */
const R = window.RECTS;
const FEUILLE = window.MESURES;
const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const SC_ACCUEIL = R.voirTout.y - 300;
const SC_LISTE = R.carte.y - 250;
const SC_FICHE = 250;
const SC_FORM = 611;
const ADRESSE = "teranga-way.com";
const adresseSaisie = (t) => ADRESSE.slice(0, Math.floor(clamp((t - 2.5) / 1.35) * ADRESSE.length));

const PAGES = [
  { a: 4.0, nom: "accueil", url: "teranga-way.com", titre: "Accueil" },
  { a: 10.4, nom: "liste", url: "teranga-way.com/logements?tri=prix-croissant", titre: "Logements" },
  { a: 16.6, nom: "fiche", url: "teranga-way.com/logements/appartement-piscine-sur-le-toit", titre: "Fiche" },
  { a: 21.6, nom: "demande", url: "teranga-way.com/demande/l-029", titre: "Demande" },
  { a: 28.6, nom: "apres", url: "teranga-way.com/demande/confirmation", titre: "Confirmation" },
];
const CHARGE = 0.9, FONDU = 0.45;
const defileAccueil = (t) => cle(t, [[0, 0], [6.1, 0], [8.7, SC_ACCUEIL], [99, SC_ACCUEIL]]);
const defileListe = (t) => cle(t, [[0, 0], [11.6, 0], [12.2, 40], [15.4, SC_LISTE], [99, SC_LISTE]], inOutSine);
const defileFiche = (t) => cle(t, [[0, 0], [18.3, 0], [19.6, SC_FICHE], [99, SC_FICHE]]);
const defileForm = (t) => cle(t, [[0, 0], [21.9, 0], [22.6, 200], [25.9, 200], [27.3, SC_FORM], [99, SC_FORM]]);
const defile = (nom, t) => nom === "accueil" ? defileAccueil(t) : nom === "liste" ? defileListe(t) : nom === "fiche" ? defileFiche(t) : nom === "demande" ? defileForm(t) : 0;
/** Vitesse **réelle** du défilement, en px de canvas par seconde : le scénario est ralenti dans ces plages. */
const RALENTIS = [[6.1, 8.7, 5.0], [11.6, 15.4, 14.0]];
const rapport = (t) => { for (const [a, b, reel] of RALENTIS) if (t >= a && t <= b) return (b - a) / reel; return 1; };
const vitesse = (nom, t) => (defile(nom, t + 0.02) - defile(nom, t - 0.02)) / 0.04 * K * rapport(t);

function dessinerContenu(ctx, t) {
  ctx.save(); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, CY, W, CH);
  const i = PAGES.reduce((m, p, j) => (t >= p.a + CHARGE ? j : m), -1);
  if (i < 0) {
    ctx.fillStyle = "#F4F6F9"; rr(ctx, 120, CY + 700, 840, 110, 55); ctx.fill();
    ctx.fillStyle = "#9AA3AE"; ctx.font = `400 34px ${FONT}`; ctx.textBaseline = "middle"; ctx.fillText("Rechercher ou saisir une adresse", 190, CY + 756);
  }
  ctx.restore();
  if (i >= 0) {
    const p = PAGES[i], k = P(t, p.a + CHARGE, p.a + CHARGE + FONDU);
    if (i > 0 && k < 1) { const pn = PAGES[i - 1].nom; page(ctx, pn, defile(pn, t), 1, 0); }
    if (p.nom === "demande") {
      const sc = defileForm(t); page(ctx, "demande", sc, k, vitesse("demande", t));
      [[R.nom, 22.9], [R.email, 23.6], [R.tel, 24.3]].forEach(([r, t0]) => {
        const kk = clamp((t - t0) / 0.7); if (kk <= 0) return;
        ctx.save(); ctx.beginPath(); ctx.rect(cx(r.x) - 40, cy(r.y - 14, sc), (r.w * K + 40) * outCubic(kk) + 40, (r.h + 28) * K); ctx.clip();
        page(ctx, "remplie", sc, 1, 0); ctx.restore();
      });
    } else if (p.nom === "apres") page(ctx, "apres", 0, k);
    else page(ctx, p.nom, defile(p.nom, t), k, vitesse(p.nom, t));
    // la barre « Demander ce logement » est fixe en bas de la fiche
    if (p.nom === "fiche" || (i > 0 && PAGES[i - 1].nom === "fiche" && k < 1)) {
      const a = p.nom === "fiche" ? k : 1 - k;
      ctx.save(); ctx.beginPath(); ctx.rect(0, CY, W, CH); ctx.clip(); ctx.globalAlpha *= a;
      ctx.beginPath(); ctx.rect(0, CY + 1330, W, 320); ctx.clip(); page(ctx, "ficheVp", 0, 1); ctx.restore();
    }
  }
  // la proposition de transport : une feuille qui monte du bas
  if (t >= 30.4) {
    const ouvre = outCubic(P(t, 30.4, 31.1)), ferme = inOut(P(t, 37.0, 37.6)), rep = inOut(P(t, 33.5, 34.0));
    const dim = ouvre * (1 - ferme);
    if (dim > 0) {
      const te = cy(FEUILLE.e - 34), tf = cy(FEUILLE.f - 34), bas = CY + CH;
      ctx.save(); ctx.beginPath(); ctx.rect(0, CY, W, CH); ctx.clip();
      ctx.fillStyle = `rgba(0,29,53,${0.5 * dim})`; ctx.fillRect(0, CY, W, CH);
      const dy = ((1 - ouvre) + ferme) * (bas - Math.min(te, tf) + 30);
      ctx.translate(0, dy);
      ctx.save(); ctx.beginPath(); ctx.rect(0, te, W, bas - te + 60); ctx.clip(); ctx.globalAlpha *= 1 - rep; page(ctx, "popup", 0, 1); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, tf, W, bas - tf + 60); ctx.clip(); ctx.globalAlpha *= rep; page(ctx, "oui", 0, 1); ctx.restore();
      ctx.restore();
    }
  }
}

/** Le doigt : position du canvas selon l'instant. */
function doigtPos(t) {
  const kf = [
    [0.8, [900, 1500]], [1.9, [540, 110]], [2.4, [540, 110]],
    [4.6, [800, 900]], [8.8, [700, 1000]],
    [9.5, [cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]], [10.2, [cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]],
    [11.6, [800, 1100]], [15.7, [700, 1200]],
    [16.3, [cx(mid(R.carte)[0]), cy(mid(R.carte)[1], SC_LISTE)]], [16.9, [cx(mid(R.carte)[0]), cy(mid(R.carte)[1], SC_LISTE)]],
    [18.0, [800, 900]], [19.8, [700, 1100]],
    [20.9, [cx(mid(R.demander)[0]), cy(mid(R.demander)[1])]], [21.7, [cx(mid(R.demander)[0]), cy(mid(R.demander)[1])]],
    [22.9, [cx(R.nom.x + 140), cy(R.nom.y + 10, 200)]], [23.6, [cx(R.email.x + 140), cy(R.email.y + 10, 200)]], [24.3, [cx(R.tel.x + 100), cy(R.tel.y + 10, 200)]],
    [25.2, [cx(R.semaine.x + 60), cy(R.semaine.y + 20, 200)]], [26.0, [cx(R.semaine.x + 60), cy(R.semaine.y + 20, 200)]],
    [28.2, [cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]], [28.9, [cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]],
    [30.6, [800, 1300]],
    [33.0, [cx(mid(R.oui)[0]), cy(mid(R.oui)[1])]], [34.4, [cx(mid(R.oui)[0]), cy(mid(R.oui)[1])]],
    [35.4, [cx(R.vol.x + 120), cy(R.vol.y + 22)]],
    [36.5, [cx(mid(R.cont)[0]), cy(mid(R.cont)[1])]], [37.3, [cx(mid(R.cont)[0]), cy(mid(R.cont)[1])]],
    [38.2, [800, 1400]],
  ];
  return cle(t, kf);
}
const CLICS = [1.9, 9.9, 16.4, 21.0, 28.4, 33.4, 36.8];

const CAMERA = [
  [0.0, [1.0, 540, 960]], [1.8, [1.0, 540, 960]],
  [2.0, [1.7, 540, 190]], [4.2, [1.7, 540, 190]], [5.0, [1.0, 540, 960]],
  [8.6, [1.0, 540, 960]], [9.4, [1.4, cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]], [10.3, [1.4, cx(mid(R.voirTout)[0]), cy(mid(R.voirTout)[1], SC_ACCUEIL)]], [11.0, [1.0, 540, 960]],
  [15.8, [1.0, 540, 960]], [16.3, [1.35, cx(mid(R.carte)[0]), cy(mid(R.carte)[1], SC_LISTE)]], [16.9, [1.35, cx(mid(R.carte)[0]), cy(mid(R.carte)[1], SC_LISTE)]], [17.6, [1.0, 540, 960]],
  [20.2, [1.0, 540, 960]], [20.8, [1.4, cx(mid(R.demander)[0]), cy(mid(R.demander)[1])]], [21.5, [1.4, cx(mid(R.demander)[0]), cy(mid(R.demander)[1])]], [22.2, [1.0, 540, 960]],
  [22.4, [1.08, 540, 860]], [25.8, [1.08, 540, 860]], [26.8, [1.0, 540, 960]],
  [28.0, [1.4, cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]], [29.0, [1.4, cx(mid(R.continuer)[0]), cy(mid(R.continuer)[1], SC_FORM)]], [29.8, [1.0, 540, 960]],
  [30.6, [1.0, 540, 960]], [31.6, [1.0, 540, 960]], [37.4, [1.0, 540, 960]], [38.4, [1.0, 540, 960]],
];

function dessiner(ctx, t) {
  t = clamp(t, 0, DUREE - 0.001);
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#001D35"); g.addColorStop(0.6, "#0F2A47"); g.addColorStop(1, "#001628");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) glow(ctx, rnd(i) * W, (rnd(i + 5) * H + t * 14) % H, 120 + rnd(i + 8) * 160, i % 3 === 0 ? "rgba(245,187,69,0.55)" : "rgba(70,150,220,0.45)", 0.2);

  const sortie = inOut(P(t, 39.4, 40.8)), entree = outCubic(P(t, 0, 1.2));
  let [z, fx, fy] = cle(t, CAMERA);
  fx = clamp(fx, 540 / z, W - 540 / z); fy = clamp(fy, 960 / z, H - 960 / z);
  ctx.save();
  const k = z * (0.94 + 0.06 * entree) * lerp(1, 0.6, sortie);
  ctx.translate(540, 960 + (1 - entree) * 160 - sortie * 500); ctx.scale(k, k); ctx.translate(-fx, -fy);
  ctx.globalAlpha = (0.2 + 0.8 * entree) * (1 - sortie);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 60; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.restore();

  const i = PAGES.reduce((m, p, j) => (t >= p.a ? j : m), -1);
  const nav = { texte: "", saisie: false, caret: false, charge: 0 };
  if (t < 4.0) { nav.texte = adresseSaisie(t); nav.saisie = t > 1.9; nav.caret = nav.saisie && Math.floor(t * 2.2) % 2 === 0; }
  else { const p = PAGES[Math.max(i, 0)], d = P(t, p.a, p.a + CHARGE); nav.texte = p.url; nav.charge = d < 1 ? 0.05 + outCubic(d) * 0.95 : 0; }
  dessinerContenu(ctx, t);
  barres(ctx, nav);

  halo(ctx, R.voirTout, SC_ACCUEIL, t, 8.8, 10.0);
  pression(ctx, R.voirTout, SC_ACCUEIL, t, 9.9, 9.95);
  halo(ctx, R.carte, SC_LISTE, t, 15.6, 16.6, C.jaune, 18);
  halo(ctx, R.demander, 0, t, 20.0, 21.2); pression(ctx, R.demander, 0, t, 21.0, 21.05);
  halo(ctx, R.semaine, 200, t, 24.8, 26.2);
  halo(ctx, R.continuer, SC_FORM, t, 27.5, 28.6); pression(ctx, R.continuer, SC_FORM, t, 28.4, 28.45);
  if (t > 31.2 && t < 37.2) { halo(ctx, R.oui, 0, t, 32.2, 33.6); halo(ctx, R.vol, 0, t, 34.4, 35.8, C.vertClair); halo(ctx, R.cont, 0, t, 36.0, 37.0); }

  if (t > 0.9 && t < 39.0) {
    const [x, y] = doigtPos(t);
    const presse = CLICS.reduce((m, c) => Math.max(m, P(t, c, c + 0.12) * (1 - P(t, c + 0.12, c + 0.35))), 0);
    CLICS.forEach((c) => touche(ctx, x, y, t, c + 0.04));
    doigt(ctx, x, y, presse);
  }
  ctx.restore();

  if (sortie > 0) {
    const a = P(t, 40.2, 41.2), kk = outBack(P(t, 40.2, 41.4)), lk = inOut(P(t, 40.6, 42.2));
    ctx.save(); ctx.strokeStyle = C.jaune; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(540 - 300 * lk, 1100); ctx.lineTo(540 + 300 * lk, 1100); ctx.stroke();
    glow(ctx, 540, 1100, 360, "rgba(245,187,69,0.7)", 0.35 * lk);
    if (LOGO && LOGO.complete) { const w = 900, h = w * LOGO.height / LOGO.width; ctx.globalAlpha = a; ctx.translate(540, 940); ctx.scale(kk, kk); ctx.drawImage(LOGO, -w / 2, -h / 2, w, h); }
    ctx.restore();
  }
}

/** Le temps réel → le temps du scénario : le défilement des pages longues se déroule plus lentement. */
const SEGMENTS = [[6.1, 8.7, 5.0], [11.6, 15.4, 14.0]]; // [début, fin dans le scénario, durée réelle]
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
