import { ouvrir } from "./cdp.mjs"; import { writeFileSync } from "node:fs";
const S = process.argv[2]; const p = await ouvrir({ largeur: 1920, hauteur: 1080 });
try {
  await p.aller("https://seydany.com/");
  console.log("hauteur page", await p.ev("document.documentElement.scrollHeight"), "titre", await p.ev("document.title"));
  console.log("liens collections", JSON.stringify(await p.ev(`[...document.querySelectorAll('a[href*="/collections/"]')].slice(0,15).map(a=>[a.getAttribute('href'),a.innerText.trim().slice(0,30)])`)));
  writeFileSync(S + "/home0.jpg", await p.photo());
  await p.aller("https://seydany.com/collections/bagues");
  console.log("produits", JSON.stringify(await p.ev(`[...document.querySelectorAll('a[href*="/products/"]')].slice(0,6).map(a=>a.getAttribute('href'))`)));
  writeFileSync(S + "/col0.jpg", await p.photo());
} finally { p.fermer(); }
