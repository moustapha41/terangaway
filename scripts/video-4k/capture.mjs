// Capture les vraies pages de la plateforme, en haute définition, par tranches.
// Usage : node capture.mjs desktop|vertical
//
// Les pages sont découpées en tranches de hauteur fixe (une tranche = un nombre
// entier de pixels) : les très longues pages — la liste de 45 logements, à 5,5×
// sur un téléphone — dépassent ce qu'une seule image peut porter. Avant chaque
// capture on fait défiler toute la page : les images « paresseuses » ne se
// chargent qu'en entrant dans la fenêtre, et une capture prise sans cela montre
// des vignettes grises.
import { spawn } from "node:child_process"; import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve } from "node:path";

const format = process.argv[2] ?? "desktop";
const CFG = {
  desktop: { VW: 1440, VH: 733, DPR: 2.5, tranche: 800, mobile: false },
  vertical: { VW: 390, VH: 596, DPR: 72 / 13, tranche: 650, mobile: true }, // 650 × 72/13 = 3600 px exactement
}[format];
const { VW, VH, DPR, tranche, mobile } = CFG;
const SORTIE = resolve(import.meta.dirname, "ressources", format); mkdirSync(SORTIE, { recursive: true });
const profil = mkdtempSync(join(tmpdir(), "c4k-"));
const PORT = 9360 + (format === "desktop" ? 0 : 1);
const chrome = spawn("google-chrome-stable", ["--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",`--remote-debugging-port=${PORT}`,`--user-data-dir=${profil}`,"about:blank"],{stdio:"ignore"});
await new Promise(r=>setTimeout(r,4000));
const cible = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent("about:blank")}`,{method:"PUT"})).json();
const ws=new WebSocket(cible.webSocketDebuggerUrl); let n=0; const att=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&att.has(m.id)){att.get(m.id)(m);att.delete(m.id);}};
await new Promise(o=>ws.onopen=o);
const cmd=(method,params={})=>new Promise(o=>{const i=++n;att.set(i,o);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>(await cmd("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await cmd("Page.enable"); await cmd("Network.enable");
await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none !important}";document.head.appendChild(s)})`});
await cmd("Emulation.setDeviceMetricsOverride",{width:VW,height:VH,deviceScaleFactor:DPR,mobile});

const manifeste = { format, dpr: DPR, vw: VW, vh: VH, pages: {} }, rects = {};
const hauteur = () => ev("document.documentElement.scrollHeight");
const go = async (u, ms = 4500) => { await cmd("Page.navigate", { url: u }); await pause(ms); };
const rect = (nom, txt, sel = "button,a,input", vp = false) => ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>${txt ? "x.textContent.includes(" + JSON.stringify(txt) + ")" : "true"}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left,y:r.top+(${vp}?0:scrollY),w:r.width,h:r.height}})()`).then(v => { rects[nom] = v; });
const clic = (txt, sel = "button,a") => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.textContent.includes(${JSON.stringify(txt)})); if(!b) return 'introuvable'; b.click(); return 'ok'})()`);
const remplir = (sel, val) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'x'; const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(e,${JSON.stringify(val)}); e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'})()`);
const cacherFixes = () => ev(`(()=>{for(const e of document.querySelectorAll("body *")){const c=getComputedStyle(e);if(c.position==="fixed"&&e.getBoundingClientRect().top>200){e.style.visibility="hidden"}}})()`);

/** Fait défiler toute la page pour charger les images paresseuses, puis attend qu'elles soient là. */
async function toutCharger() {
  await ev(`document.querySelectorAll('img[loading="lazy"]').forEach(i=>{i.loading="eager"})`);
  const h = await hauteur();
  for (let y = 0; y < h; y += Math.round(VH * 0.8)) { await ev(`window.scrollTo(0,${y})`); await pause(350); }
  await ev(`window.scrollTo(0,${h})`); await pause(600);
  for (let essai = 0; essai < 40; essai++) {
    const reste = await ev(`[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length`);
    if (!reste) break; await pause(500);
  }
  await ev(`window.scrollTo(0,0)`); await pause(500);
}
/** Une page entière, par tranches de hauteur fixe. */
async function page(nom, haut) {
  const h = Math.min(haut ?? await hauteur(), await hauteur());
  const tuiles = [];
  for (let y0 = 0, i = 0; y0 < h; y0 += tranche, i++) {
    const hh = Math.min(tranche, h - y0);
    const r = await cmd("Page.captureScreenshot", { format: "jpeg", quality: 93, captureBeyondViewport: true, clip: { x: 0, y: y0, width: VW, height: hh, scale: 1 } });
    const f = `${nom}-${i}.jpg`; writeFileSync(join(SORTIE, f), Buffer.from(r.result.data, "base64")); tuiles.push({ f, y0, y1: y0 + hh });
  }
  manifeste.pages[nom] = { cssH: h, tuiles };
  console.log(nom, h, "css,", tuiles.length, "tranches");
}
/** Ce que voit la fenêtre, sans défilement. */
async function fenetre(nom) {
  const r = await cmd("Page.captureScreenshot", { format: "jpeg", quality: 93 });
  const f = `${nom}-0.jpg`; writeFileSync(join(SORTIE, f), Buffer.from(r.result.data, "base64"));
  manifeste.pages[nom] = { cssH: VH, tuiles: [{ f, y0: 0, y1: VH }] };
}
const B = "http://localhost:3000/fr";

// 1. l'accueil
await go(B); await rect("voirTout", "Voir tous les logements"); await toutCharger();
await cacherFixes(); await page("accueil", Math.round(rects.voirTout.y + VH));
// 2. la liste
await go(`${B}/logements?tri=prix-croissant&debut=2026-11-01&fin=2026-11-08`);
await rect("carte", "Appartement deux chambres avec piscine sur le toit", "a[href*='/logements/']"); await toutCharger();
await cacherFixes(); await page("liste", Math.round(rects.carte.y + VH));
// 3. la fiche
await go(`${B}/logements/appartement-piscine-sur-le-toit?debut=2026-11-01&fin=2026-11-08`); await toutCharger();
await fenetre("ficheVp"); await rect("demander", "Demander ce logement", "button,a", mobile);
await cacherFixes(); await page("fiche", 1500);
// 4. le formulaire
await go(`${B}/demande/l-029?debut=2026-11-01&fin=2026-11-08`); await toutCharger();
await page("demande");
await rect("nom", null, 'input[name="nom"]'); await rect("email", null, 'input[name="email"]'); await rect("tel", null, '#demande-telephone'); await rect("semaine", "1 semaine"); await rect("continuer", "Continuer");
await remplir('input[name="nom"]', "Aminata Diallo"); await remplir('input[name="email"]', "aminata@exemple.com"); await remplir('#demande-telephone', "77 123 45 67"); await pause(500);
await page("remplie");
// 5. la confirmation (demande réelle)
const r = await (await fetch("http://localhost:3001/demandes/logement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logementId: "l-029", debut: "2026-11-01", fin: "2026-11-08", personnes: 2, contact: { email: "video.demo@exemple.sn", nom: "Aminata Diallo" } }) })).json();
const recap = { id: r.donnees.id, reference: r.donnees.reference, titre: "Appartement deux chambres avec piscine sur le toit", logementId: "l-029", debut: "2026-11-01", fin: "2026-11-08", personnes: 2, statut: "envoyee", emailEnvoye: true, acompteAnnonce: false, jetonSuite: r.notification.jetonSuite };
await cmd("Network.setCookie", { name: "teranga_recap", value: encodeURIComponent(JSON.stringify(recap)), domain: "localhost", path: "/" });
await go(`${B}/demande/confirmation?reference=${recap.reference}`, 6000);
await fenetre("popup");
await rect("oui", "Oui, je veux une voiture", "dialog button", true); await rect("plustard", "Répondre plus tard", "dialog button", true);
await clic("Oui, je veux une voiture", "dialog button"); await pause(2500);
await fenetre("oui"); await rect("vol", "Envoyer mon numéro de vol", "dialog a", true); await rect("cont", "Continuer", "dialog button", true);
await clic("Continuer", "dialog button"); await pause(1200);
await fenetre("apres");

// étendue de la fenêtre modale / feuille, mesurée sur les pixels de la capture (en css)
writeFileSync(join(SORTIE, "manifeste.json"), JSON.stringify({ ...manifeste, rects }, null, 1));
ws.close(); chrome.kill();
