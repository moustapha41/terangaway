import { ouvrir } from "./cdp.mjs"; import { writeFileSync } from "node:fs";
const S = process.argv[2]; const p = await ouvrir({ largeur: 360, hauteur: 640, echelle: 2 });
try {
  await p.aller("https://seydany.com/products/cerisia");
  for (let i = 0; i < 20; i++) { const t = await p.ev("document.title + ' | ' + document.body.innerText.slice(0,60).replace(/\\n/g,' ')"); if (i % 4 === 0) console.log(i, t); if (!/connexion|v[ée]rif/i.test(t)) { console.log("passé à", i); break; } await p.attendre(1000); }
  writeFileSync(S + "/m_prod.jpg", await p.photo(80)); console.log("H prod", await p.ev("document.documentElement.scrollHeight"));
} finally { p.fermer(); }
