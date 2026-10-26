/**
 * Motion design « Accompagnement » : de l'avion au logement, sans un mot.
 *
 * Tout est dessiné au canvas, à partir du temps `t` seul : la même fonction
 * rend n'importe quelle image, dans le navigateur comme à l'enregistrement.
 * Aucun texte, aucun sous-titre : l'histoire se lit par les images.
 *
 *   1. L'avion traverse un ciel de coucher de soleil.
 *   2. Le choix : sur un téléphone, deux cartes — la voiture, ou se débrouiller.
 *      Le doigt choisit la voiture.
 *   3. À l'aéroport, le chauffeur est là ; la valise entre dans le coffre.
 *   4. Le trajet se trace sur la carte, de l'aéroport au logement.
 *   5. Le voyageur arrive, la porte s'ouvre sur la lumière.
 *   6. La marque.
 */
const W = 1920, H = 1080;
const C = {
  nuit: "#001D35", nuit2: "#0F2A47", jaune: "#F5BB45", jaune2: "#E8A33D",
  vert: "#087443", vertClair: "#2FB574", blanc: "#FFFFFF", corail: "#E8604C",
  sable: "#F3E7CF", mer: "#2B7FA8", peau: "#8D5A3B", peau2: "#C28A62",
};
const SCENES = [
  { a: 0.0, b: 5.4 },   // 1 ciel
  { a: 4.6, b: 11.2 },  // 2 choix
  { a: 10.4, b: 17.4 }, // 3 aéroport
  { a: 16.6, b: 22.8 }, // 4 carte
  { a: 22.0, b: 28.4 }, // 5 arrivée
  { a: 27.6, b: 31.0 }, // 6 marque
];
const DUREE = 31.0;

/* ───────────── outils ───────────── */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const outCubic = (k) => 1 - Math.pow(1 - k, 3);
const inCubic = (k) => k * k * k;
const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const outBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const outElastic = (k) => k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1;

function rr(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, fill) { rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function vgrad(ctx, y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/* ───────────── pièces dessinées ───────────── */
function nuage(ctx, x, y, s, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "rgba(255,255,255,0.92)";
  [[0, 0, 60], [55, -20, 70], [120, 0, 62], [60, 14, 62], [-40, 18, 40], [165, 16, 40]].forEach(([dx, dy, r]) => {
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

/** Avion de profil, cap à droite. (0,0) au centre du fuselage. */
function avion(ctx, x, y, s, inclin = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(inclin); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  // aile arrière
  ctx.fillStyle = "#DDE6EE"; ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(-95, -78); ctx.lineTo(-62, -78); ctx.lineTo(20, -8); ctx.closePath(); ctx.fill();
  // dérive
  ctx.fillStyle = C.jaune; ctx.beginPath(); ctx.moveTo(-170, -14); ctx.lineTo(-208, -92); ctx.lineTo(-166, -92); ctx.lineTo(-118, -14); ctx.closePath(); ctx.fill();
  // fuselage
  const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#C9D6E3");
  rr(ctx, -200, -34, 400, 68, 34); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.moveTo(150, -34); ctx.quadraticCurveTo(232, -20, 224, 8); ctx.quadraticCurveTo(205, 34, 150, 34); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  // bandeau
  ctx.save(); rr(ctx, -200, -34, 400, 68, 34); ctx.clip(); ctx.fillStyle = C.nuit; ctx.fillRect(-210, 12, 440, 9); ctx.fillStyle = C.jaune; ctx.fillRect(-210, 21, 440, 5); ctx.restore();
  // hublots + cockpit
  for (let i = 0; i < 11; i++) circle(ctx, -120 + i * 22, -6, 6.2, C.nuit2);
  ctx.fillStyle = C.nuit2; ctx.beginPath(); ctx.moveTo(165, -22); ctx.lineTo(206, -14); ctx.lineTo(196, -4); ctx.lineTo(160, -4); ctx.closePath(); ctx.fill();
  // aile avant + réacteur
  ctx.fillStyle = "#EEF3F8"; ctx.beginPath(); ctx.moveTo(-20, 10); ctx.lineTo(-100, 96); ctx.lineTo(-58, 96); ctx.lineTo(48, 10); ctx.closePath(); ctx.fill();
  fillRR(ctx, -36, 40, 76, 26, 13, "#B7C5D4"); fillRR(ctx, 30, 42, 14, 22, 7, C.nuit2);
  ctx.restore();
}

/** Voiture de profil, cap à droite. (0,0) = sol sous l'essieu arrière-milieu. */
function voiture(ctx, x, y, s, o = {}) {
  const { roue = 0, coffre = 0, phares = 1, lumiereToit = 1, passager = 0, chauffeur = 1 } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // ombre
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, 6, 205, 15, 0, 0, Math.PI * 2); ctx.fill();
  // coffre (volet articulé)
  ctx.save(); ctx.translate(-190, -88); ctx.rotate(-coffre * 1.05);
  ctx.fillStyle = "#F4F6F9"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(80, 0); ctx.lineTo(80, 10); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  // caisse
  const gb = ctx.createLinearGradient(0, -112, 0, -22); gb.addColorStop(0, "#FFFFFF"); gb.addColorStop(1, "#D9E2EC");
  ctx.beginPath(); ctx.moveTo(-200, -30); ctx.lineTo(-200, -78); ctx.quadraticCurveTo(-198, -92, -176, -92); ctx.lineTo(-96, -92);
  ctx.lineTo(-62, -140); ctx.lineTo(70, -140); ctx.lineTo(128, -92); ctx.lineTo(180, -86); ctx.quadraticCurveTo(206, -82, 206, -58); ctx.lineTo(206, -30);
  ctx.quadraticCurveTo(206, -22, 196, -22); ctx.lineTo(-190, -22); ctx.quadraticCurveTo(-200, -22, -200, -30); ctx.closePath();
  ctx.fillStyle = gb; ctx.fill();
  // liseré jaune
  ctx.fillStyle = C.jaune; ctx.fillRect(-196, -62, 400, 8);
  // vitres
  ctx.fillStyle = "#9FC3DA";
  ctx.beginPath(); ctx.moveTo(-86, -96); ctx.lineTo(-56, -134); ctx.lineTo(-6, -134); ctx.lineTo(-6, -96); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6, -96); ctx.lineTo(6, -134); ctx.lineTo(66, -134); ctx.lineTo(112, -96); ctx.closePath(); ctx.fill();
  // têtes dans l'habitacle
  if (passager > 0) { ctx.globalAlpha = passager; circle(ctx, -36, -112, 15, C.peau); ctx.fillStyle = C.nuit; ctx.beginPath(); ctx.arc(-36, -114, 15, Math.PI, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1; }
  if (chauffeur > 0) { ctx.globalAlpha = chauffeur; circle(ctx, 62, -112, 15, C.peau2); ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(62, -114, 15, Math.PI, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1; }
  // poignée, bas de caisse
  fillRR(ctx, 20, -78, 26, 6, 3, "#9AA7B6"); fillRR(ctx, -200, -30, 406, 8, 4, "#AEB9C6");
  // phares
  if (phares > 0) { glow(ctx, 224, -50, 110, "rgba(255,238,170,0.9)", 0.55 * phares); circle(ctx, 200, -52, 8, "#FFF3C4"); }
  circle(ctx, -198, -52, 6, "#E0443A");
  // enseigne de toit
  ctx.save(); ctx.globalAlpha = lumiereToit; fillRR(ctx, -26, -162, 56, 24, 8, C.jaune); fillRR(ctx, -14, -156, 32, 12, 5, "#FFE6A3"); ctx.restore();
  // roues
  [-128, 128].forEach((wx) => {
    circle(ctx, wx, -26, 40, "#0B1622"); circle(ctx, wx, -26, 23, "#C9D3DE"); circle(ctx, wx, -26, 9, "#5E6B7A");
    ctx.save(); ctx.translate(wx, -26); ctx.rotate(roue); ctx.strokeStyle = "#8793A1"; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 21); ctx.stroke(); }
    ctx.restore();
  });
  ctx.restore();
}

function voyageur(ctx, x, y, s, o = {}) {
  const { pas = 0, vers = 1, bras = 0, echarpe = C.corail } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * vers, s);
  const bob = Math.abs(Math.sin(pas)) * 4;
  ctx.translate(0, -bob);
  const sw = Math.sin(pas) * 18;
  // jambes
  ctx.strokeStyle = C.nuit2; ctx.lineWidth = 15; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-5, -90); ctx.lineTo(-5 + sw, -8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -90); ctx.lineTo(8 - sw, -8); ctx.stroke();
  // corps
  fillRR(ctx, -26, -190, 52, 104, 24, "#2B6CB0");
  ctx.fillStyle = echarpe; fillRR(ctx, -22, -192, 44, 14, 7, echarpe);
  // bras
  ctx.strokeStyle = "#2B6CB0"; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(0, -176);
  ctx.lineTo(18 + bras * 10, -138 - bras * 70); ctx.stroke();
  circle(ctx, 18 + bras * 10, -136 - bras * 72, 8, C.peau);
  // tête
  circle(ctx, 0, -218, 24, C.peau);
  ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-1, -222, 24, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.restore();
}
function valise(ctx, x, y, s, rot = 0, couleur = C.jaune) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  fillRR(ctx, -34, -86, 68, 80, 12, couleur); fillRR(ctx, -34, -52, 68, 8, 2, "rgba(0,0,0,0.18)");
  ctx.strokeStyle = "#6B5320"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-12, -86); ctx.lineTo(-12, -102); ctx.lineTo(12, -102); ctx.lineTo(12, -86); ctx.stroke();
  circle(ctx, -22, -4, 6, "#222"); circle(ctx, 22, -4, 6, "#222");
  ctx.restore();
}
function palmier(ctx, x, y, s, vent = 0, teinte = "#1F8F5A") {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = "#7A5230"; ctx.lineWidth = 16; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14 + vent * 4, -120, 6 + vent * 8, -240); ctx.stroke();
  ctx.translate(6 + vent * 8, -240);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + Math.sin(vent + i) * 0.05;
    ctx.save(); ctx.rotate(a); ctx.fillStyle = teinte;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(60, -40 + (i % 2) * 20, 130, 14); ctx.quadraticCurveTo(60, -4, 0, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  circle(ctx, 0, 6, 9, "#5A3A20");
  ctx.restore();
}
function pin(ctx, x, y, s, couleur, icone) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = couleur; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-52, -52, -56, -120, 0, -120); ctx.bezierCurveTo(56, -120, 52, -52, 0, 0); ctx.fill();
  circle(ctx, 0, -78, 30, "#FFF");
  ctx.translate(0, -78); ctx.fillStyle = couleur; ctx.strokeStyle = couleur;
  if (icone === "avion") { ctx.rotate(-0.6); rr(ctx, -16, -4, 32, 8, 4); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-12, -16); ctx.lineTo(-5, -16); ctx.lineTo(6, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-12, 16); ctx.lineTo(-5, 16); ctx.lineTo(6, 0); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(0, -14); ctx.lineTo(16, 2); ctx.lineTo(11, 2); ctx.lineTo(11, 14); ctx.lineTo(-11, 14); ctx.lineTo(-11, 2); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function icoVoiture(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-60, 14); ctx.lineTo(-60, -8); ctx.quadraticCurveTo(-58, -16, -46, -16); ctx.lineTo(-30, -16); ctx.lineTo(-16, -38); ctx.lineTo(24, -38); ctx.lineTo(42, -16); ctx.quadraticCurveTo(58, -14, 60, -2); ctx.lineTo(60, 14); ctx.closePath(); ctx.fill();
  circle(ctx, -32, 16, 14, col); circle(ctx, 32, 16, 14, col);
  ctx.globalCompositeOperation = "destination-out"; circle(ctx, -32, 16, 6, "#000"); circle(ctx, 32, 16, 6, "#000"); ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
function icoMarche(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round"; ctx.lineWidth = 11;
  circle(ctx, 6, -52, 12, col);
  ctx.beginPath(); ctx.moveTo(4, -34); ctx.lineTo(-4, 6); ctx.moveTo(4, -30); ctx.lineTo(28, -8); ctx.moveTo(2, -28); ctx.lineTo(-22, -10);
  ctx.moveTo(-4, 6); ctx.lineTo(-24, 40); ctx.moveTo(-4, 6); ctx.lineTo(16, 24); ctx.lineTo(18, 44); ctx.stroke();
  ctx.restore();
}
function coche(ctx, x, y, s, col, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(-6, 18); ctx.lineTo(24, -16);
  // tracé progressif
  ctx.setLineDash([120]); ctx.lineDashOffset = 120 * (1 - k); ctx.stroke();
  ctx.restore();
}
function doigt(ctx, x, y, s, rot = -0.35) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(10, 14, 38, 18, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, C.peau2); g.addColorStop(1, C.peau);
  rr(ctx, -28, 0, 56, 360, 28); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)"; fillRR(ctx, -14, 10, 14, 24, 7, "rgba(255,255,255,0.25)");
  ctx.restore();
}

/* ═════════════ 1. LE CIEL ═════════════ */
function sceneCiel(ctx, s) {
  ctx.fillStyle = vgrad(ctx, 0, 760, [[0, "#14214F"], [0.38, "#6B3F7E"], [0.68, "#E8604C"], [1, "#F5BB45"]]);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const a = clamp(1 - s / 3) * rnd(i) * 0.9; if (a > 0.02) circle(ctx, rnd(i + 9) * W, rnd(i + 31) * 380, 1 + rnd(i + 4) * 2, `rgba(255,255,255,${a})`); }
  const cam = outCubic(P(s, 0, 5.4));
  const sx = 1280, sy = 700 - cam * 20;
  glow(ctx, sx, sy, 520, "rgba(255,214,120,0.85)", 0.9);
  circle(ctx, sx, sy, 128, "#FFE6A3"); circle(ctx, sx, sy, 100, "#FFF2CC");
  // mer
  ctx.fillStyle = vgrad(ctx, 720, H, [[0, "#244A7A"], [1, "#0B2342"]]); ctx.fillRect(0, 720, W, H - 720);
  for (let i = 0; i < 16; i++) {
    const y = 730 + i * 22, wdt = 520 * (1 - i / 22) * (0.8 + 0.2 * Math.sin(s * 2 + i));
    ctx.fillStyle = `rgba(255,214,120,${0.55 - i * 0.03})`; ctx.fillRect(sx - wdt / 2 + Math.sin(s * 1.5 + i) * 18, y, wdt, 6);
  }
  // nuages en parallaxe
  [[0.3, 190, 0.9, 40], [0.5, 420, 1.2, 25], [0.8, 120, 1.5, 50], [1.1, 560, 0.8, 30]].forEach(([v, y, sc, off], i) => {
    const x = ((off * 14 + i * 520 - s * 130 * v) % (W + 600) + (W + 600)) % (W + 600) - 300;
    nuage(ctx, x, y, sc, 0.85);
  });
  // avion : entre par la gauche, traverse
  const lin = P(s, 0.0, 5.4), k = lerp(lin, inOut(lin), 0.3);
  const px = lerp(-420, W + 420, k), py = lerp(470, 300, k) + Math.sin(s * 2.2) * 8;
  // traînée
  for (let i = 0; i < 30; i++) { const tx = px - 270 - i * 30, a = (1 - i / 30) * 0.5; circle(ctx, tx, py + 18 + i * 0.4, 5 - i * 0.12, `rgba(255,255,255,${a})`); }
  avion(ctx, px, py, 1.25, -0.07 + Math.sin(s * 2.2) * 0.012);
}

/* ═════════════ 2. LE CHOIX ═════════════ */
function sceneChoix(ctx, s) {
  ctx.fillStyle = vgrad(ctx, 0, H, [[0, "#0F2A47"], [1, "#001D35"]]); ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { const x = rnd(i) * W, y = (rnd(i + 5) * H + s * 18 * (1 + rnd(i + 2))) % H; glow(ctx, x, y, 80 + rnd(i + 8) * 130, i % 3 === 0 ? "rgba(245,187,69,0.5)" : "rgba(80,150,210,0.4)", 0.35); }
  const sortie = inOut(P(s, 5.0, 6.4));
  const entree = outBack(P(s, 0.1, 1.0));
  const cx = 960 - sortie * 700, cy = 540 + (1 - entree) * 700 + sortie * 40;
  const sc = lerp(1, 0.78, sortie);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(0, 440, 220, 30, 0, 0, Math.PI * 2); ctx.fill();
  fillRR(ctx, -230, -420, 460, 860, 62, "#0A0F16"); fillRR(ctx, -218, -408, 436, 836, 52, "#F4F7FA");
  fillRR(ctx, -48, -396, 96, 24, 12, "#0A0F16");
  // en-tête
  fillRR(ctx, -190, -330, 380, 150, 26, C.nuit);
  circle(ctx, -128, -255, 40, C.jaune); ctx.save(); ctx.translate(-128, -255); ctx.rotate(-0.6); ctx.fillStyle = C.nuit; rr(ctx, -20, -5, 40, 10, 5); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-15, -20); ctx.lineTo(-6, -20); ctx.lineTo(8, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-15, 20); ctx.lineTo(-6, 20); ctx.lineTo(8, 0); ctx.fill(); ctx.restore();
  fillRR(ctx, -70, -278, 200, 16, 8, "rgba(255,255,255,0.8)"); fillRR(ctx, -70, -248, 130, 12, 6, "rgba(255,255,255,0.4)");
  // deux cartes : le choix
  const pop = (a) => outBack(P(s, a, a + 0.7));
  const choisi = outCubic(P(s, 3.0, 3.7));
  // carte voiture
  ctx.save(); ctx.translate(-98, -30); const pv = pop(1.0); ctx.scale(pv * (1 + choisi * 0.06), pv * (1 + choisi * 0.06));
  fillRR(ctx, -88, -105, 176, 210, 28, choisi > 0 ? mix("#E9EEF4", C.vert, choisi) : "#E9EEF4");
  icoVoiture(ctx, 0, -5, 1.15, choisi > 0.5 ? "#fff" : C.nuit);
  circle(ctx, 0, 72, 12 + choisi * 4, choisi > 0.5 ? "#fff" : "#9AA7B6");
  ctx.restore();
  // carte marche
  ctx.save(); ctx.translate(98, -30); const pm = pop(1.25); ctx.scale(pm * (1 - choisi * 0.04), pm * (1 - choisi * 0.04)); ctx.globalAlpha = 1 - choisi * 0.45;
  fillRR(ctx, -88, -105, 176, 210, 28, "#E9EEF4"); icoMarche(ctx, 0, 0, 1.2, C.nuit2); circle(ctx, 0, 72, 12, "#9AA7B6");
  ctx.restore();
  // badge coche
  if (choisi > 0) { const b = outElastic(P(s, 3.35, 4.1)); ctx.save(); ctx.translate(-98 + 82, -30 - 100); ctx.scale(b, b); circle(ctx, 0, 0, 34, C.jaune); coche(ctx, 0, 0, 0.9, C.nuit, P(s, 3.5, 4.0)); ctx.restore(); }
  // bouton
  const bt = outBack(P(s, 1.6, 2.3));
  ctx.save(); ctx.translate(0, 270); ctx.scale(bt, bt);
  fillRR(ctx, -170, -34, 340, 68, 34, choisi > 0.2 ? C.vert : "#CBD5E0");
  if (choisi > 0.2) { ctx.globalAlpha = P(s, 3.7, 4.2); coche(ctx, 0, 0, 0.8, "#fff", P(s, 3.8, 4.4)); }
  ctx.restore();
  ctx.restore();
  // doigt : arrive, tape, repart
  const dk = P(s, 2.0, 3.0), repart = P(s, 3.9, 4.6);
  const dx0 = cx - 98 * sc, dy0 = cy - 30 * sc;
  const fx = lerp(dx0 + 380, dx0 + 20, outCubic(dk)) + repart * 260;
  const fy = lerp(dy0 + 520, dy0 + 80, outCubic(dk)) + Math.sin(P(s, 2.85, 3.15) * Math.PI) * -18 + repart * 420;
  if (s > 1.9 && s < 4.9) doigt(ctx, fx, fy, 1.0);
  // ondes du tapotement
  for (let i = 0; i < 3; i++) { const k = P(s, 2.95 + i * 0.16, 3.7 + i * 0.16); if (k > 0 && k < 1) { ctx.strokeStyle = `rgba(245,187,69,${0.9 * (1 - k)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(dx0, dy0, 40 + k * 190, 0, Math.PI * 2); ctx.stroke(); } }
  // étincelles
  for (let i = 0; i < 18; i++) { const k = P(s, 3.4, 4.5), a = rnd(i) * Math.PI * 2, d = 40 + k * (150 + rnd(i + 3) * 200); if (k > 0 && k < 1) circle(ctx, dx0 + Math.cos(a) * d, dy0 + Math.sin(a) * d, 5 * (1 - k) + 1, i % 2 ? C.jaune : "#fff"); }
  // la voiture jaillit du téléphone et file à droite
  const vk = P(s, 5.1, 6.6);
  if (vk > 0) { voiture(ctx, lerp(560, 2300, inCubic(vk)), 760, lerp(0.4, 1.1, outCubic(P(s, 5.1, 5.8))), { roue: s * 14 }); }
}
function mix(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], k))).join(",")})`;
}

/* ═════════════ 3. L'AÉROPORT ═════════════ */
function sceneAeroport(ctx, s) {
  const pan = outCubic(P(s, 4.8, 7.0)) * 520;
  ctx.fillStyle = vgrad(ctx, 0, 760, [[0, "#6FB3D9"], [1, "#FDE3B0"]]); ctx.fillRect(0, 0, W, H);
  glow(ctx, 330, 190, 380, "rgba(255,240,200,0.9)", 0.8);
  nuage(ctx, 220 - s * 8, 170, 1.0, 0.9); nuage(ctx, 1400 - s * 10, 120, 1.3, 0.9);
  // avion lointain qui décolle
  avion(ctx, lerp(2100, 900, P(s, 0, 6)) - 0, lerp(260, 140, P(s, 0, 6)), 0.34, -0.22);
  ctx.save(); ctx.translate(-pan * 0.35, 0);
  // terminal
  fillRR(ctx, 700, 330, 1250, 420, 20, "#F6F8FA");
  ctx.fillStyle = C.nuit; ctx.fillRect(660, 300, 1330, 56);
  ctx.fillStyle = C.jaune; ctx.fillRect(660, 356, 1330, 10);
  const vitre = vgrad(ctx, 400, 750, [[0, "#9FD0E8"], [1, "#4F8FB8"]]);
  for (let i = 0; i < 9; i++) { const x = 740 + i * 134; if (i === 5) continue; fillRR(ctx, x, 410, 104, 300, 8, vitre); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.moveTo(x + 10, 710); ctx.lineTo(x + 50, 410); ctx.lineTo(x + 74, 410); ctx.lineTo(x + 34, 710); ctx.fill(); }
  // panneau avion
  fillRR(ctx, 1010, 318, 90, 30, 8, C.jaune); ctx.save(); ctx.translate(1055, 333); ctx.scale(0.18, 0.18); ctx.fillStyle = C.nuit; rr(ctx, -80, -12, 160, 24, 12); ctx.fill(); ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-50, -60); ctx.lineTo(-20, -60); ctx.lineTo(40, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-50, 60); ctx.lineTo(-20, 60); ctx.lineTo(40, 0); ctx.fill(); ctx.restore();
  // portes coulissantes
  const ouv = outCubic(P(s, 1.0, 1.9)) * (1 - P(s, 4.6, 5.2) * 0.9);
  const dx = 1410; fillRR(ctx, dx - 8, 400, 16 + 250, 322, 8, "#FFF6DF");
  glow(ctx, dx + 120, 600, 260, "rgba(255,226,150,0.9)", 0.6 * ouv);
  fillRR(ctx, dx, 410, 120 - ouv * 100, 312, 6, vitre); fillRR(ctx, dx + 120 + ouv * 100, 410, 120 - ouv * 100, 312, 6, vitre);
  // palmiers du parvis
  palmier(ctx, 620, 770, 1.1, s * 1.2); palmier(ctx, 1840, 770, 1.3, s * 1.1 + 2);
  ctx.restore();
  // chaussée
  ctx.fillStyle = "#3A4656"; ctx.fillRect(0, 770, W, 310);
  ctx.fillStyle = "#4A5668"; ctx.fillRect(0, 770, W, 22);
  ctx.fillStyle = "#6D7B8E"; ctx.fillRect(0, 792, W, 8);
  ctx.fillStyle = "rgba(255,255,255,0.55)"; for (let i = -1; i < 14; i++) ctx.fillRect(((i * 220 - pan * 0.9) % 2800 + 2800) % 2800 - 200, 930, 120, 10);
  // voiture : arrive, s'arrête, charge, repart
  const arrive = outCubic(P(s, 0.0, 1.8)), part = inCubic(P(s, 5.2, 6.9));
  const vx = lerp(-420, 800, arrive) + part * 1700 - pan * 0.0;
  const rouleDe = (arrive < 1 ? 1 - arrive : 0) + part;
  const coffre = outCubic(P(s, 2.0, 2.6)) * (1 - outCubic(P(s, 4.0, 4.5)));
  const pass = P(s, 4.1, 4.5);
  const tr = vx + 0;
  const vyy = 900;
  voiture(ctx, tr, vyy, 1.05, { roue: s * 14 * (arrive < 1 || part > 0 ? 1 : 0.0) + (arrive < 1 || part > 0 ? 0 : 0), coffre, passager: pass, chauffeur: 1 });
  // voyageur : sort des portes, marche vers le coffre
  const mk = outCubic(P(s, 1.7, 3.2));
  const vx0 = dx + 120 - pan * 0.35, vx1 = 800 - 200 * 1.05 + 40;
  const px = lerp(vx0, vx1, mk), marche = mk < 1 && mk > 0;
  const entre = P(s, 4.0, 4.5);
  if (s > 1.7 && entre < 1) {
    ctx.save(); ctx.globalAlpha = 1 - entre;
    voyageur(ctx, px, 930, 0.95, { pas: marche ? s * 9 : 0, vers: -1, bras: P(s, 3.2, 3.5) * (1 - P(s, 3.6, 3.9)) });
    ctx.restore();
  }
  // valise : roule avec lui, puis saute dans le coffre
  const saut = inOut(P(s, 3.0, 3.9));
  if (s > 1.7 && saut < 1) {
    const vxv = lerp(px + 52, vx1 - 62 + 70, 0) ;
    const roulant = { x: px + 56, y: 934 };
    const cible = { x: tr - 150, y: vyy - 118 };
    const bx = lerp(roulant.x, cible.x, saut), by = lerp(roulant.y, cible.y, saut) - Math.sin(saut * Math.PI) * 120;
    valise(ctx, bx, by, 0.95, saut * -0.4);
  }
  // sillage de poussière quand la voiture démarre
  if (part > 0) for (let i = 0; i < 8; i++) glow(ctx, tr - 230 - i * 46, 900 - i * 3, 50 + i * 4, "rgba(255,255,255,0.5)", 0.4 * (1 - i / 8));
  // petit coche de confirmation au-dessus de la voiture
  const ck = outElastic(P(s, 4.5, 5.2)) * (1 - P(s, 5.6, 6.0));
  if (ck > 0.01) { ctx.save(); ctx.translate(tr + 40, 700); ctx.scale(ck, ck); circle(ctx, 0, 0, 42, C.vert); coche(ctx, 0, 0, 1.0, "#fff", 1); ctx.restore(); }
}

/* ═════════════ 4. LA CARTE ═════════════ */
const ROUTE = [[330, 250], [640, 250], [820, 360], [900, 560], [1160, 640], [1360, 780], [1560, 800]];
let ROUTE_PTS = null;
function routePoints() {
  if (ROUTE_PTS) return ROUTE_PTS;
  const pts = [];
  const cat = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const p0 = ROUTE[Math.max(0, i - 1)], p1 = ROUTE[i], p2 = ROUTE[i + 1], p3 = ROUTE[Math.min(ROUTE.length - 1, i + 2)];
    for (let k = 0; k < 40; k++) { const t = k / 40; pts.push([cat(p0[0], p1[0], p2[0], p3[0], t), cat(p0[1], p1[1], p2[1], p3[1], t)]); }
  }
  pts.push(ROUTE[ROUTE.length - 1]); ROUTE_PTS = pts; return pts;
}
function sceneCarte(ctx, s) {
  const pts = routePoints();
  const k = inOut(P(s, 0.9, 4.9)), idx = Math.min(pts.length - 1, Math.floor(k * (pts.length - 1)));
  const [vx, vy] = pts[idx];
  const camx = lerp(960, vx, 0.55), camy = lerp(540, vy, 0.55);
  const zoom = lerp(1.0, 1.25, outCubic(P(s, 0, 1.2)));
  ctx.save(); ctx.translate(960, 540); ctx.scale(zoom, zoom); ctx.translate(-camx, -camy);
  // terre
  ctx.fillStyle = C.sable; ctx.fillRect(-600, -400, 3400, 2000);
  // mer (à gauche et en bas)
  ctx.fillStyle = C.mer; ctx.beginPath(); ctx.moveTo(-600, -400); ctx.lineTo(-100, -400); ctx.bezierCurveTo(140, 80, 380, 440, 500, 760); ctx.bezierCurveTo(580, 960, 800, 1100, 1100, 1300); ctx.lineTo(-600, 1500); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-100, -400); ctx.bezierCurveTo(140, 80, 380, 440, 500, 760); ctx.bezierCurveTo(580, 960, 800, 1100, 1100, 1300); ctx.stroke();
  for (let i = 0; i < 26; i++) { const x = -300 + rnd(i) * 800, y = rnd(i + 3) * 1100 - 100, w = 40 + rnd(i + 8) * 60; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y + Math.sin(s * 2 + i) * 4); ctx.quadraticCurveTo(x + w / 2, y - 12, x + w, y + Math.sin(s * 2 + i) * 4); ctx.stroke(); }
  // quartiers : blocs
  for (let i = 0; i < 60; i++) {
    const x = 520 + rnd(i) * 1500, y = -120 + rnd(i + 20) * 1100;
    if (distPts(pts, x + 30, y + 30) < 110) continue;
    const w = 50 + rnd(i + 2) * 70, h = 40 + rnd(i + 5) * 60;
    fillRR(ctx, x, y, w, h, 8, i % 3 === 0 ? "#EBD9B3" : i % 3 === 1 ? "#E3CFA5" : "#F0E1BF");
  }
  // parcs et palmiers
  for (let i = 0; i < 26; i++) { const x = 560 + rnd(i + 50) * 1500, y = -100 + rnd(i + 70) * 1050; if (distPts(pts, x, y) < 90) continue; circle(ctx, x, y, 26, "#7FBF7A"); circle(ctx, x - 8, y - 8, 14, "#9ACF8F"); }
  // route (fond) + tracé progressif
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 46; strokePts(ctx, pts, pts.length);
  ctx.strokeStyle = "#C9CED6"; ctx.lineWidth = 34; strokePts(ctx, pts, pts.length);
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.setLineDash([22, 22]); ctx.lineDashOffset = -s * 40; ctx.lineWidth = 4; strokePts(ctx, pts, pts.length); ctx.setLineDash([]);
  // trajet parcouru : jaune lumineux
  ctx.strokeStyle = C.jaune; ctx.lineWidth = 20; strokePts(ctx, pts, idx + 1);
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 6; strokePts(ctx, pts, idx + 1);
  // épingles
  const p1 = outBack(P(s, 0.3, 1.0)), p2 = outBack(P(s, 3.9, 4.8));
  pin(ctx, ROUTE[0][0], ROUTE[0][1] + 50 * (1 - p1) * -1 + 0, p1, C.nuit, "avion");
  pin(ctx, ROUTE[ROUTE.length - 1][0], ROUTE[ROUTE.length - 1][1] - (1 - p2) * 120 + Math.sin(s * 4) * 4 * p2, p2, C.vert, "maison");
  // petits avions de décor
  ctx.save(); ctx.translate(ROUTE[0][0] - 20, ROUTE[0][1] - 190 - s * 20); ctx.globalAlpha = 0.9; avion(ctx, 0, 0, 0.22, -0.4); ctx.restore();
  // voiture en marche : halo + voiture vue de dessus stylisée
  const [qx, qy] = pts[Math.max(0, idx - 1)], ang = Math.atan2(vy - qy, vx - qx);
  glow(ctx, vx, vy, 120, "rgba(245,187,69,0.9)", 0.8);
  ctx.save(); ctx.translate(vx, vy); ctx.rotate(ang); ctx.scale(1.9, 1.9);
  fillRR(ctx, -30, -17, 60, 34, 12, "#FFFFFF"); fillRR(ctx, -4, -12, 20, 24, 6, "#7FA8C4"); fillRR(ctx, -26, -2, 18, 4, 2, C.jaune);
  circle(ctx, 28, -9, 4, "#FFF3C4"); circle(ctx, 28, 9, 4, "#FFF3C4");
  ctx.restore();
  // sillage d'étincelles
  for (let i = 0; i < 10; i++) { const j = Math.max(0, idx - i * 3); circle(ctx, pts[j][0], pts[j][1], 8 - i * 0.7, `rgba(255,255,255,${0.6 - i * 0.055})`); }
  ctx.restore();
  // vignette
  const g = ctx.createRadialGradient(960, 540, 400, 960, 540, 1150); g.addColorStop(0, "rgba(0,29,53,0)"); g.addColorStop(1, "rgba(0,29,53,0.35)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function strokePts(ctx, pts, n) { ctx.beginPath(); for (let i = 0; i < n && i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.stroke(); }
function distPts(pts, x, y) { let m = 1e9; for (let i = 0; i < pts.length; i += 3) { const d = Math.hypot(pts[i][0] - x, pts[i][1] - y); if (d < m) m = d; } return m; }

/* ═════════════ 5. L'ARRIVÉE ═════════════ */
function sceneArrivee(ctx, s) {
  const nuitK = outCubic(P(s, 0, 4));
  const zoomPorte = inOut(P(s, 4.6, 6.4));
  ctx.save(); ctx.translate(1260, 680); ctx.scale(1 + zoomPorte * 1.3, 1 + zoomPorte * 1.3); ctx.translate(-1260, -680);
  ctx.fillStyle = vgrad(ctx, 0, 800, [[0, mix("#2B4C8C", "#0B1B3A", nuitK)], [0.7, mix("#F08A4B", "#2A3B72", nuitK)], [1, mix("#F5BB45", "#6B4E7A", nuitK)]]); ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const a = nuitK * rnd(i) * (0.5 + 0.5 * Math.sin(s * 2 + i)); circle(ctx, rnd(i + 9) * W, rnd(i + 31) * 420, 1 + rnd(i + 4) * 2, `rgba(255,255,255,${a})`); }
  circle(ctx, 1500, 200 - nuitK * 0 + 60 * (1 - nuitK), 60, `rgba(255,244,214,${0.2 + nuitK * 0.7})`);
  // collines
  ctx.fillStyle = mix("#2F6B5A", "#10301F", nuitK); ctx.beginPath(); ctx.moveTo(0, 700); ctx.bezierCurveTo(400, 600, 700, 720, 1000, 660); ctx.bezierCurveTo(1400, 590, 1700, 700, 1920, 640); ctx.lineTo(1920, 800); ctx.lineTo(0, 800); ctx.fill();
  // sol
  ctx.fillStyle = mix("#6B5B45", "#2A2230", nuitK); ctx.fillRect(0, 790, W, 290);
  ctx.fillStyle = mix("#8A7A60", "#3A3040", nuitK); ctx.fillRect(0, 790, W, 16);
  ctx.save();
  // maison
  const lum = outCubic(P(s, 1.4, 2.8));
  fillRR(ctx, 980, 470, 560, 330, 10, mix("#F4E9D8", "#C9BBA8", nuitK * 0.6));
  ctx.fillStyle = C.nuit; ctx.beginPath(); ctx.moveTo(940, 480); ctx.lineTo(1260, 340); ctx.lineTo(1580, 480); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.jaune; ctx.fillRect(940, 478, 640, 10);
  // fenêtres lumineuses
  [[1030, 540], [1380, 540]].forEach(([x, y]) => { fillRR(ctx, x, y, 110, 130, 8, mix("#9FC3DA", "#FFD982", lum)); glow(ctx, x + 55, y + 65, 160, "rgba(255,210,120,0.9)", 0.55 * lum); ctx.fillStyle = "rgba(0,29,53,0.5)"; ctx.fillRect(x + 53, y, 4, 130); ctx.fillRect(x, y + 63, 110, 4); });
  // porte
  const ouv = outCubic(P(s, 4.0, 5.0));
  fillRR(ctx, 1190, 560, 140, 240, 10, "#FFE1A0");
  glow(ctx, 1260, 680, 300, "rgba(255,224,150,0.95)", 0.9 * ouv);
  ctx.save(); ctx.translate(1190, 0); ctx.scale(1 - ouv * 0.82, 1); fillRR(ctx, 0, 560, 140, 240, 10, "#7A4A2A"); circle(ctx, 120, 690, 7, C.jaune); ctx.restore();
  // allée éclairée
  ctx.fillStyle = `rgba(255,224,150,${0.55 * ouv})`; ctx.beginPath(); ctx.moveTo(1190, 800); ctx.lineTo(1330, 800); ctx.lineTo(1500, 1000); ctx.lineTo(1020, 1000); ctx.closePath(); ctx.fill();
  ctx.restore();
  palmier(ctx, 800, 800, 1.5, s * 1.3, mix("#1F8F5A", "#0F4A30", nuitK)); palmier(ctx, 1700, 800, 1.2, s * 1.1 + 1, mix("#1F8F5A", "#0F4A30", nuitK));
  // voiture : arrive de la gauche, s'arrête devant le portail
  const ak = outCubic(P(s, 0.0, 1.7));
  const vx = lerp(-380, 600, ak);
  const sortie = P(s, 1.8, 2.6);
  voiture(ctx, vx, 960, 1.05, { roue: s * 14 * (ak < 1 ? 1 : 0), passager: 1 - sortie, phares: 1, coffre: P(s, 2.6, 3.0) * (1 - P(s, 3.4, 3.8)) });
  // voyageur : descend, prend sa valise, marche vers la porte
  const wk = inOut(P(s, 2.5, 4.4)), vxv = lerp(vx - 60, 1250, wk);
  if (s > 1.8) {
    ctx.save(); ctx.globalAlpha = P(s, 1.8, 2.3);
    voyageur(ctx, vxv, 940 - 0 * wk, 0.95, { pas: wk > 0 && wk < 1 ? s * 9 : 0, vers: 1, bras: 0 });
    valise(ctx, vxv - 50 + 0, 944, 0.9, 0);
    ctx.restore();
  }
  ctx.restore();
  // badge de bienvenue
  const bk = outElastic(P(s, 5.2, 6.1));
  if (bk > 0.01) { ctx.save(); ctx.translate(960, 320); ctx.scale(bk, bk); glow(ctx, 0, 0, 200, "rgba(245,187,69,0.8)", 0.6); circle(ctx, 0, 0, 78, C.vert); circle(ctx, 0, 0, 66, "#0B8E54"); coche(ctx, 0, 0, 1.7, "#fff", P(s, 5.5, 6.1)); ctx.restore(); }
}

/* ═════════════ 6. LA MARQUE ═════════════ */
let LOGO = null;
function sceneMarque(ctx, s) {
  ctx.fillStyle = vgrad(ctx, 0, H, [[0, "#0F2A47"], [1, "#001D35"]]); ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) { const x = rnd(i) * W, y = (rnd(i + 5) * H + s * 20) % H; glow(ctx, x, y, 60 + rnd(i + 8) * 120, "rgba(245,187,69,0.45)", 0.25); }
  const k = outBack(P(s, 0.2, 1.1)), a = P(s, 0.2, 0.8);
  // route lumineuse qui file sous la marque, avec la voiture
  const lk = inOut(P(s, 0.1, 1.6));
  ctx.strokeStyle = C.jaune; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(960 - 520 * lk, 700); ctx.lineTo(960 + 520 * lk, 700); ctx.stroke();
  glow(ctx, 960, 700, 360, "rgba(245,187,69,0.7)", 0.35 * lk);
  if (LOGO && LOGO.complete) { const w = 820, h = w * LOGO.height / LOGO.width; ctx.save(); ctx.globalAlpha = a; ctx.translate(960, 480); ctx.scale(k, k); ctx.drawImage(LOGO, -w / 2, -h / 2, w, h); ctx.restore(); }
  const vk = inOut(P(s, 0.4, 3.0)); voiture(ctx, lerp(-300, 2300, vk), 694, 0.42, { roue: s * 16 });
}

/* ═════════════ montage ═════════════ */
const SCENES_FN = [sceneCiel, sceneChoix, sceneAeroport, sceneCarte, sceneArrivee, sceneMarque];
function dessinerScene(ctx, i, t) { SCENES_FN[i](ctx, t - SCENES[i].a); }

function trace(ctx, type, p, x = W / 2, y = H / 2) {
  ctx.beginPath();
  if (type === "iris") { ctx.arc(x, y, Math.hypot(W, H) * p, 0, Math.PI * 2); }
  else if (type === "glisse") { const yy = H * (1 - p); rr(ctx, 0, yy, W, H - yy + 80, 70 * (1 - p) + 1); }
  else if (type === "lames") {
    // trois bandes diagonales qui se déploient, décalées
    for (let i = 0; i < 4; i++) { const k = clamp(p * 1.6 - i * 0.2); const w = W * 0.34, x0 = -W * 0.3 + i * (W * 0.27); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w, 0); ctx.lineTo(x0 + w - 260, H * k); ctx.lineTo(x0 - 260, H * k); ctx.closePath(); ctx.moveTo(0, 0); }
    ctx.rect(0, 0, 0, 0);
  } else ctx.rect(0, 0, W, H);
}
const TRANS = [
  { i: 1, type: "iris", d: 0.8, couleur: C.jaune },
  { i: 2, type: "glisse", d: 0.8, couleur: C.jaune },
  { i: 3, type: "lames", d: 0.8, couleur: C.jaune },
  { i: 4, type: "iris", d: 0.8, couleur: C.jaune, x: 1260, y: 640 },
  { i: 5, type: "fondu", d: 0.8, couleur: C.nuit },
];
function dessiner(ctx, t) {
  t = clamp(t, 0, DUREE - 0.001);
  // la scène en cours (la plus avancée dont l'entrée a eu lieu)
  let cur = 0; for (let i = 0; i < SCENES.length; i++) if (t >= SCENES[i].a + (i ? TRANS[i - 1].d : 0)) cur = i; else break;
  // transition en cours ?
  const next = SCENES.findIndex((sc, i) => i > 0 && t >= sc.a && t < sc.a + TRANS[i - 1].d);
  if (next > 0) {
    const tr = TRANS[next - 1], p = (t - SCENES[next].a) / tr.d, e = inOut(p);
    dessinerScene(ctx, next - 1, t);
    ctx.save();
    if (tr.type === "fondu") { ctx.globalAlpha = e; dessinerScene(ctx, next, t); }
    else {
      trace(ctx, tr.type, e, tr.x, tr.y); ctx.clip();
      dessinerScene(ctx, next, t);
    }
    ctx.restore();
    // liseré jaune sur le bord de l'iris
    if (tr.type === "iris") { ctx.save(); ctx.strokeStyle = tr.couleur; ctx.lineWidth = 18 * (1 - Math.abs(e - 0.5) * 1.2); ctx.beginPath(); ctx.arc(tr.x ?? W / 2, tr.y ?? H / 2, Math.hypot(W, H) * e, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (tr.type === "glisse") { ctx.save(); ctx.fillStyle = tr.couleur; const yy = H * (1 - e); ctx.fillRect(0, yy - 14, W, 14); ctx.restore(); }
  } else dessinerScene(ctx, cur, t);
}
