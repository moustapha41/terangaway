import { ouvrir } from "./cdp.mjs"; import { writeFileSync } from "node:fs";
const S = process.argv[2]; const p = await ouvrir({ largeur: 1920, hauteur: 1080 });
try {
  await p.aller("https://seydany.com/products/fleur"); await p.attendre(1500);
  writeFileSync(S + "/prod0.jpg", await p.photo());
  console.log("boutons", JSON.stringify(await p.ev(`[...document.querySelectorAll('button,[type=submit],a.button')].map(b=>[b.tagName,(b.innerText||b.value||'').trim().slice(0,30),b.name||'',b.className.slice(0,40)]).filter(x=>x[1]).slice(0,20)`)));
  console.log("form panier", await p.ev(`document.querySelector('form[action*="/cart/add"]')?.outerHTML.slice(0,300)`));
} finally { p.fermer(); }
