// Version téléphone (viewport 360×550, 9:16 une fois placé dans le navigateur) : on tape seydany.com, accueil,
// menu, Parures, produit Anna, formulaire de commande (sans l'envoyer).   node capturer-mobile.mjs <dossier>   env : ECHELLE=6 (4K) ou 1 (essai)
import { ouvrir } from "./cdp.mjs"; import { mkdirSync, writeFileSync } from "node:fs"; import { join, resolve } from "node:path";
const sortie = resolve(process.argv[2]); mkdirSync(sortie, { recursive: true });
const FPS = 30, ECHELLE = Number(process.env.ECHELLE ?? 6), SITE = "https://seydany.com", VH = 550;
const p = await ouvrir({ largeur: 360, hauteur: VH, echelle: ECHELLE });
const sequence = []; let nFichiers = 0, doigt = { x: 250, y: 400 }, appui = 0, url = "", dernier = -1;
const doux = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const meta = (o = {}) => sequence.push({ i: dernier, u: url, c: 0, s: false, k: false, ...o });
const injecter = () => p.ev(`(()=>{ if(document.getElementById('__doigt')) return; const c=document.createElement('div'); c.id='__doigt';
  c.style.cssText='position:fixed;left:-22px;top:-22px;width:44px;height:44px;z-index:2147483647;pointer-events:none;will-change:transform';
  c.innerHTML='<div style="position:absolute;left:8px;top:8px;width:28px;height:28px;border-radius:50%;background:rgba(40,30,20,.35);border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.25)"></div><div id="__onde" style="position:absolute;left:0;top:0;width:44px;height:44px;border-radius:50%;border:3px solid rgba(190,130,60,.9);opacity:0"></div>';
  document.documentElement.appendChild(c); const s=document.createElement('style'); s.textContent='nextjs-portal{display:none!important}'; document.head.appendChild(s); })()`);
const placer = () => p.ev(`(()=>{const c=document.getElementById('__doigt'); if(!c) return; c.style.transform='translate(${doigt.x}px,${doigt.y}px) scale(${1 - 0.2 * appui})'; const o=document.getElementById('__onde'); if(o){o.style.opacity='${appui}'; o.style.transform='scale(${0.6 + 1.2 * (1 - appui)})';}})()`, false);
const lireUrl = async () => { url = "seydany.com" + (await p.ev("location.pathname")).replace(/\/$/, ""); };
async function image() {
  await placer(); await p.attendre(25);
  writeFileSync(join(sortie, `${String(nFichiers).padStart(5, "0")}.jpg`), await p.photo(92)); dernier = nFichiers++; meta();
  if (nFichiers % 30 === 0) console.log("images", nFichiers);
}
const maintenir = async (s) => { for (let i = 0; i < Math.round(s * FPS); i++) meta(); };
const rect = (sel, texte) => p.ev(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>{const r=e.getBoundingClientRect();return r.width>8&&r.height>8&&(${JSON.stringify(texte ?? "")}===''||e.innerText.trim().startsWith(${JSON.stringify(texte ?? "")}))}); const e=l[0]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
async function defiler(de, a, s) { const n = Math.round(s * FPS); for (let i = 1; i <= n; i++) { await p.ev(`window.scrollTo(0,${de + (a - de) * doux(i / n)})`, false); await image(); } }
async function vers(x, y, s) { const d = { ...doigt }, n = Math.max(2, Math.round(s * FPS)); for (let i = 1; i <= n; i++) { const u = doux(i / n); doigt = { x: d.x + (x - d.x) * u, y: d.y + (y - d.y) * u }; await image(); } }
async function appuyer(envoyer = true) {
  for (let i = 0; i <= 4; i++) { appui = i / 4; await image(); }
  if (envoyer) for (const type of ["mousePressed", "mouseReleased"]) await p.cmd("Input.dispatchMouseEvent", { type, x: doigt.x, y: doigt.y, button: "left", clickCount: 1 });
  for (let i = 3; i >= 0; i--) { appui = i / 4; await image(); }
}
async function preparer() {
  await injecter(); const h = await p.ev("document.documentElement.scrollHeight");
  for (let y = 0; y < h; y += 400) { await p.ev(`window.scrollTo(0,${y})`, false); await p.attendre(120); }
  await p.ev(`document.querySelectorAll('img[loading=lazy]').forEach(i=>{i.loading='eager'})`, false);
  for (let i = 0; i < 40 && !(await p.ev(`[...document.images].every(i=>i.complete&&(i.naturalWidth>0||!i.currentSrc))`)); i++) await p.attendre(300);
  await p.attendre(600); await p.ev("window.scrollTo(0,0)", false); await p.attendre(700); await injecter();
}
async function apresClic(avant) { // la page change : barre de chargement sur l'ancienne image, puis la nouvelle page
  for (let i = 0; i < 60 && (await p.ev("location.href")) === avant; i++) await p.attendre(100);
  for (let i = 0; i < 60 && (await p.ev("document.readyState")) !== "complete"; i++) await p.attendre(150);
  await p.attendre(900); await preparer(); await lireUrl();
  for (let i = 1; i <= 9; i++) meta({ c: i / 10 });
}
async function amener(sel, texte, marge) { const r = await rect(sel, texte); if (!r) throw new Error("introuvable : " + sel + " " + texte); const y0 = await p.ev("window.scrollY"); await defiler(y0, Math.max(0, y0 + r.y - marge), 0.8); }
async function toucher(sel, texte, s = 0.5) { const r = await rect(sel, texte); if (!r) throw new Error("introuvable : " + sel + " " + texte); const av = await p.ev("location.href"); await vers(r.x, r.y, s); await appuyer(true); await apresClic(av); }
try {
  await p.aller(SITE + "/"); await preparer();
  // 1. on tape l'adresse dans un navigateur vide
  const saisie = "seydany.com"; url = ""; dernier = -1;
  for (let i = 0; i < 12; i++) meta({ s: true, k: true, u: "" });
  for (let n = 1; n <= saisie.length; n++) { for (let j = 0; j < 2; j++) meta({ s: true, k: j === 0, u: saisie.slice(0, n) }); }
  for (let i = 0; i < 10; i++) meta({ s: true, k: i < 5, u: saisie });
  await lireUrl(); const H = await p.ev("document.documentElement.scrollHeight"), max = H - VH;
  await image(); for (let i = 1; i <= 8; i++) meta({ c: i / 9 }); await maintenir(0.3);
  // 2. l'accueil
  await defiler(0, max, 4.6); await maintenir(0.1); await defiler(max, 0, 0.8);
  // 3. menu, Collections
  const m = await rect('button[aria-label="Ouvrir le menu"]'); await vers(m.x, m.y, 0.5); await appuyer(true); await p.attendre(800); await image(); await maintenir(0.4);
  await toucher("a", "Collections", 0.5);
  // 4. Parures, puis Anna
  await maintenir(0.3); await amener('a[href*="/collections/parures"]', "Parures", 300);
  await toucher('a[href*="/collections/parures"]', "Parures", 0.5);
  await maintenir(0.3); await amener('a[href="/products/anna"]', "", 280);
  await toucher('a[href="/products/anna"]', "", 0.5);
  // 5. le formulaire
  await maintenir(0.5); await amener("button", "COMMANDER", 330); await maintenir(0.3);
  for (const [placeholder, texte] of [["Prénom et Nom", "Aminata Diallo"], ["Téléphone", "77 123 45 67"], ["Adresse", "Médina, Dakar"]]) {
    const r = await rect(`input[placeholder="${placeholder}"]`); await vers(r.x + 40, r.y, 0.4); await appuyer(true);
    for (const ch of texte) { await p.cmd("Input.insertText", { text: ch }); await image(); await image(); }
    await maintenir(0.2);
  }
  const b = await rect("button", "COMMANDER"); await vers(b.x, b.y, 0.5);
  // on envoie la commande et on filme la validation jusqu'au bout (au plus 6 s)
  const avant = await p.ev("location.href"); await appuyer(true);
  const debut = nFichiers;
  for (let i = 0; i < 6 * FPS; i++) {
    await injecter(); await lireUrl(); await image();
    if (i === 3 * FPS) console.log("après 3 s :", url, "| texte :", (await p.ev("document.body.innerText.slice(0,160).replace(/\\n/g,' ')")));
  }
  console.log("page de validation :", url, (await p.ev("location.href")) !== avant ? "(navigation)" : "(même page)");
} finally { writeFileSync(join(sortie, "sequence.json"), JSON.stringify(sequence)); console.log("images", nFichiers, "durée", (sequence.length / FPS).toFixed(1), "s"); p.fermer(); }
