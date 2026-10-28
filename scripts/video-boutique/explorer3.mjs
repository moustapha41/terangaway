import { ouvrir } from "./cdp.mjs"; import { writeFileSync } from "node:fs";
const S = process.argv[2]; const p = await ouvrir({ largeur: 360, hauteur: 640, echelle: 2, mobile: false });
try {
  await p.aller("https://seydany.com/"); await p.attendre(1500);
  console.log("H", await p.ev("document.documentElement.scrollHeight"));
  writeFileSync(S + "/m_home.jpg", await p.photo(80));
  console.log("header", JSON.stringify(await p.ev(`[...document.querySelectorAll('header a, header button, header summary')].map(e=>{const r=e.getBoundingClientRect();return [e.tagName,(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,20),Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]}).filter(x=>x[4]>0)`)));
  await p.aller("https://seydany.com/collections/collies"); await p.attendre(1500); writeFileSync(S + "/m_col.jpg", await p.photo(80));
  await p.aller("https://seydany.com/products/cerisia"); await p.attendre(1500); writeFileSync(S + "/m_prod.jpg", await p.photo(80));
  console.log("H prod", await p.ev("document.documentElement.scrollHeight"));
} finally { p.fermer(); }
