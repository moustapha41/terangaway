/**
 * Le moteur de rendu : des images exactes, une à une, en haute définition.
 *
 * Pas d'enregistrement en temps réel : à 4K, un navigateur sans carte graphique
 * ne tient pas 30 images par seconde, et la vidéo saccaderait. Ici chaque image
 * est dessinée à son instant exact (`t = n / 30`), puis encodée en H.264 par
 * WebCodecs et rangée dans un MP4 : le temps de calcul n'a plus d'effet sur la
 * fluidité.
 *
 * Les pages (très longues) sont des tranches d'images chargées à la demande et
 * libérées ensuite : le rendu d'une liste de 5 000 px ne garde jamais plus de
 * quelques tranches en mémoire.
 */
import { Muxer, ArrayBufferTarget } from "./mp4-muxer.mjs";

const params = new URLSearchParams(location.search);
const FORMAT = params.get("format") ?? "desktop";
const ECHELLE = 2; // le décor se dessine en 1920×1080 (ou 1080×1920) ; le canvas fait le double : 4K
const FPS = 30;

const MANIFESTE = await (await fetch(`ressources/${FORMAT}/manifeste.json`)).json();
const MESURES = await (await fetch(`ressources/${FORMAT}/mesures.json`)).json();
window.RECTS = MANIFESTE.rects; window.MESURES = MESURES; window.MANIFESTE = MANIFESTE;
const CACHE = new Map(), MANQUE = new Set(), VOULU = new Set();
let courante = 0;

/** Dessine une page, à un défilement donné (px CSS) : les tranches visibles, recollées. */
window.tuilesPage = (ctx, nom, sc, vhCss, dx, dy, dw, k, alpha = 1) => {
  const pg = MANIFESTE.pages[nom]; if (!pg || alpha <= 0) return;
  const dpr = MANIFESTE.dpr, base = ctx.globalAlpha;
  for (const t of pg.tuiles) {
    if (t.y1 > sc - vhCss * 0.3 && t.y0 < sc + vhCss * 1.3) VOULU.add(t.f);
    const a = Math.max(t.y0, sc), b = Math.min(t.y1, sc + vhCss); if (b <= a) continue;
    const e = CACHE.get(t.f); if (!e) { MANQUE.add(t.f); continue; }
    e.last = courante; ctx.globalAlpha = base * alpha;
    ctx.drawImage(e.img, 0, Math.round((a - t.y0) * dpr), e.img.width, Math.min(e.img.height - Math.round((a - t.y0) * dpr), Math.round((b - a) * dpr)), dx, dy + (a - sc) * k, dw, (b - a) * k + 0.7);
  }
  ctx.globalAlpha = base;
};
async function charger(fichiers) {
  // l'une après l'autre : plusieurs grandes images décodées en même temps épuisent la mémoire
  for (const f of fichiers) {
    if (CACHE.has(f)) continue;
    for (let essai = 0; ; essai++) {
      try {
        const blob = await (await fetch(`ressources/${FORMAT}/${f}`)).blob();
        CACHE.set(f, { img: await createImageBitmap(blob), last: courante }); break;
      } catch (e) { if (essai >= 3) throw e; liberer(true); await new Promise((r) => setTimeout(r, 300)); }
    }
  }
}
/** Libère les tranches qui ne servent plus (toutes, si `tout`) : `close()` rend la mémoire sur-le-champ. */
function liberer(tout = false) { for (const [f, e] of CACHE) if (tout || e.last < courante - 60) { e.img.close(); CACHE.delete(f); } }

// le logo, en data URL (même origine, jamais « sali »)
const logo = new Image(); await new Promise((r) => { const s = document.createElement("script"); s.src = "logo.js"; s.onload = r; document.head.appendChild(s); });
logo.src = window.LOGO_URL; await logo.decode(); window.LOGO = logo;
await import(`./scene-${FORMAT}.js`);
const { W, H, DUREE_REELLE, dessiner, temps } = window.SCENE;

const canvas = document.getElementById("c"); canvas.width = W * ECHELLE; canvas.height = H * ECHELLE;
const ctx = canvas.getContext("2d"); ctx.imageSmoothingQuality = "high";

/** Une image à l'instant réel `tr` (secondes) : on charge ce qui manque, puis on redessine. */
async function rendre(tr) {
  courante++;
  for (let essai = 0; essai < 4; essai++) {
    MANQUE.clear(); VOULU.clear();
    ctx.setTransform(ECHELLE, 0, 0, ECHELLE, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
    dessiner(ctx, temps(tr));
    if (!MANQUE.size) break;
    await charger([...MANQUE]);
  }
  await charger([...VOULU]); liberer();
}
window.rendre = rendre;
window.addEventListener('error', (e) => { window.erreur = String(e.message); });
window.addEventListener('unhandledrejection', (e) => { window.erreur = String(e.reason); });
if (params.has("t")) { await rendre(parseFloat(params.get("t"))); window.pret = true; }

/** Produit le MP4 entier. Renvoie sa taille ; le contenu se lit ensuite par tranches. */
window.produire = async (debit = 45_000_000) => {
  const config = { codec: "avc1.640034", width: W * ECHELLE, height: H * ECHELLE, bitrate: debit, framerate: FPS, latencyMode: "quality" };
  const ok = await VideoEncoder.isConfigSupported(config); if (!ok.supported) throw new Error("H.264 4K non pris en charge : " + JSON.stringify(config));
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: config.width, height: config.height }, fastStart: "in-memory" });
  let erreur = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { erreur = e; } });
  enc.configure(config);
  const total = Math.min(Math.round(DUREE_REELLE * FPS), parseInt(params.get('limite') ?? '99999'));
  for (let n = 0; n < total; n++) {
    if (erreur) throw erreur;
    await rendre(n / FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(n * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
    enc.encode(frame, { keyFrame: n % 60 === 0 }); frame.close();
    window.avancement = `${n}/${total} file=${enc.encodeQueueSize} etat=${enc.state} cache=${CACHE.size}${window.erreur ? ' ERREUR=' + window.erreur : ''}`;
  }
  await enc.flush(); muxer.finalize();
  window.__mp4 = new Uint8Array(muxer.target.buffer);
  return window.__mp4.length;
};
/** Une tranche du fichier, en base64 (le canal de débogage n'accepte pas un message de 50 Mo). */
window.tranche = (i, taille) => { const b = window.__mp4.subarray(i, i + taille); let s = ""; for (let k = 0; k < b.length; k += 32768) s += String.fromCharCode.apply(null, b.subarray(k, k + 32768)); return btoa(s); };
