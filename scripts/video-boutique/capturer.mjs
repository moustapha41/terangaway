// Pilote le vrai site image par image : accueil, collection, produit, formulaire de commande (sans l'envoyer).
//   node capturer.mjs <dossier-images>      env : ECHELLE=2 (4K), LIMITE=<images>
import { ouvrir } from "./cdp.mjs"; import { mkdirSync, writeFileSync, copyFileSync } from "node:fs"; import { join, resolve } from "node:path";
const sortie = resolve(process.argv[2]); mkdirSync(sortie, { recursive: true });
const FPS = 30, ECHELLE = Number(process.env.ECHELLE ?? 2), SITE = "https://seydany.com";
const p = await ouvrir({ largeur: 1920, hauteur: 1080, echelle: ECHELLE });
const sequence = []; let nFichiers = 0, curseur = { x: 1500, y: 700 }, appui = 0;
const doux = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const injecter = () => p.ev(`(()=>{ if(document.getElementById('__curseur')) return; const c=document.createElement('div'); c.id='__curseur';
  c.style.cssText='position:fixed;left:0;top:0;width:44px;height:44px;z-index:2147483647;pointer-events:none;will-change:transform';
  c.innerHTML='<svg width="44" height="44" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M3 2l7.5 18 2.4-7.1L20 10.5z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><div id="__onde" style="position:absolute;left:-14px;top:-14px;width:36px;height:36px;border-radius:50%;border:3px solid rgba(190,130,60,.9);opacity:0"></div>';
  document.documentElement.appendChild(c);
  const s=document.createElement('style'); s.textContent='nextjs-portal{display:none!important}'; document.head.appendChild(s); })()`);
const placer = () => p.ev(`(()=>{const c=document.getElementById('__curseur'); if(!c) return; c.style.transform='translate(${curseur.x}px,${curseur.y}px) scale(${1 - 0.15 * appui})'; const o=document.getElementById('__onde'); if(o){o.style.opacity='${appui}'; o.style.transform='scale(${0.6 + 1.2 * (1 - appui)})';}})()`, false);
async function image() { // une image fixe de plus dans la vidéo
  await placer(); await p.attendre(25);
  const f = `${String(nFichiers).padStart(5, "0")}.jpg`; writeFileSync(join(sortie, f), await p.photo(92)); sequence.push(nFichiers++);
  if (nFichiers % 30 === 0) console.log("images", nFichiers);
}
const maintenir = async (s) => { for (let i = 0; i < Math.round(s * FPS); i++) sequence.push(nFichiers - 1); };
const rect = (sel, texte) => p.ev(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>{const r=e.getBoundingClientRect();return r.width>8&&r.height>8&&(${JSON.stringify(texte ?? "")}===''||e.innerText.trim().startsWith(${JSON.stringify(texte ?? "")}))}); const e=l[0]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,top:r.top,bas:r.bottom}})()`);
async function defiler(de, a, s) { const n = Math.round(s * FPS); for (let i = 1; i <= n; i++) { await p.ev(`window.scrollTo(0,${de + (a - de) * doux(i / n)})`, false); await image(); } }
async function vers(x, y, s) { const d = { ...curseur }, n = Math.max(2, Math.round(s * FPS)); for (let i = 1; i <= n; i++) { const u = doux(i / n); curseur = { x: d.x + (x - d.x) * u, y: d.y + (y - d.y) * u }; await image(); } }
async function appuyer(envoyer = true) {
  for (let i = 0; i <= 5; i++) { appui = i / 5; await image(); }
  if (envoyer) { for (const type of ["mousePressed", "mouseReleased"]) await p.cmd("Input.dispatchMouseEvent", { type, x: curseur.x, y: curseur.y, button: "left", clickCount: 1 }); }
  for (let i = 4; i >= 0; i--) { appui = i / 5; await image(); }
}
async function preparer() { // charge les images paresseuses, déclenche les apparitions, remet en haut
  await injecter(); const h = await p.ev("document.documentElement.scrollHeight");
  for (let y = 0; y < h; y += 500) { await p.ev(`window.scrollTo(0,${y})`, false); await p.attendre(120); }
  await p.ev(`document.querySelectorAll('img[loading=lazy]').forEach(i=>{i.loading='eager'})`, false);
  for (let i = 0; i < 40 && !(await p.ev(`[...document.images].every(i=>i.complete&&(i.naturalWidth>0||!i.currentSrc))`)); i++) await p.attendre(300);
  await p.attendre(600); await p.ev("window.scrollTo(0,0)", false); await p.attendre(700); await injecter();
}
async function apresClic(urlAvant) {
  for (let i = 0; i < 60 && (await p.ev("location.href")) === urlAvant; i++) await p.attendre(100);
  for (let i = 0; i < 60 && (await p.ev("document.readyState")) !== "complete"; i++) await p.attendre(150);
  await p.attendre(900); await preparer();
}
async function cliquer(sel, texte, s = 0.7) {
  const r = await rect(sel, texte); if (!r) throw new Error("introuvable : " + sel + " " + texte);
  const av = await p.ev("location.href"); await vers(r.x, r.y, s); await appuyer(true); await apresClic(av);
}
const limite = Number(process.env.LIMITE ?? 1e9);
try {
  await p.aller(SITE + "/"); await preparer(); const H = await p.ev("document.documentElement.scrollHeight"), max = H - 1080;
  await vers(1450, 640, 0.01); await image(); await maintenir(0.5);
  await defiler(0, max, 5.0); await maintenir(0.2); await defiler(max, 0, 0.9);
  await cliquer('a[href="/collections/all"]', "Collections", 0.6);
  await maintenir(0.4); await defiler(0, 330, 0.8);
  await cliquer('a[href*="/collections/bagues"]', "Bagues", 0.6);
  await maintenir(0.3); await defiler(0, 560, 0.9);
  await cliquer('a[href="/products/fleur"]', "", 0.7);
  await maintenir(0.9);
  for (const [placeholder, texte, pause] of [["Prénom et Nom", "Aminata Diallo", 0.4], ["Téléphone", "77 123 45 67", 0.3], ["Adresse", "Médina, Dakar", 0.3]]) {
    const r = await rect(`input[placeholder="${placeholder}"]`); await vers(r.x, r.y, 0.45); await appuyer(true);
    for (const c of texte) { await p.cmd("Input.insertText", { text: c }); await image(); await image(); }
    await maintenir(pause);
  }
  const b = await rect("button", "COMMANDER"); await vers(b.x, b.y, 0.5); await appuyer(false); await maintenir(0.6);
} finally { writeFileSync(join(sortie, "sequence.json"), JSON.stringify(sequence)); console.log("images", nFichiers, "durée", (sequence.length / FPS).toFixed(1), "s"); p.fermer(); }
