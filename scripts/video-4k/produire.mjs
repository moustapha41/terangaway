// Produit la vidéo 4K, ou des images fixes pour la vérifier.
//   node produire.mjs desktop|vertical <sortie.mp4>
//   node produire.mjs desktop|vertical --images 3.2,9.5,16 <dossier>
import { spawn } from "node:child_process"; import { createServer } from "node:http"; import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve, extname } from "node:path";

const [format = "desktop", a, b, c] = process.argv.slice(2);
const racine = import.meta.dirname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png" };
const serveur = createServer((req, res) => {
  const chemin = resolve(racine, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!chemin.startsWith(racine) || !existsSync(chemin)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(chemin)] ?? "application/octet-stream" }).end(readFileSync(chemin));
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
const port = serveur.address().port;
const profil = mkdtempSync(join(tmpdir(), "p4k-"));
const PORT_CDP = 9370 + (format === "desktop" ? 0 : 1);
const chrome = spawn("google-chrome-stable", ["--headless=new", "--no-sandbox", "--disable-gpu", "--enable-features=PlatformHEVCEncoderSupport", `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${profil}`, "--window-size=1280,720", "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
try {
  const cible = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl); let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, attendre = true) => { const r = await cmd("Runtime.evaluate", { expression, awaitPromise: attendre, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result?.result?.value; };
  await cmd("Page.enable"); await cmd("Runtime.enable");
  await cmd("Page.navigate", { url: `http://127.0.0.1:${port}/index.html?format=${format}${process.env.LIMITE ? '&limite=' + process.env.LIMITE : ''}` });
  for (let i = 0; i < 60 && !(await ev("typeof window.produire === 'function'", false)); i++) await new Promise((r) => setTimeout(r, 1000));

  if (a === "--images") {
    const dossier = resolve(c); mkdirSync(dossier, { recursive: true });
    for (const t of b.split(",")) {
      const b64 = await ev(`(async()=>{await window.rendre(${parseFloat(t)}); const c=document.getElementById('c'); const p=document.createElement('canvas'); p.width=c.width/2; p.height=c.height/2; p.getContext('2d').drawImage(c,0,0,p.width,p.height); return p.toDataURL('image/jpeg',0.82).split(',')[1]})()`);
      writeFileSync(join(dossier, `t${t}.jpg`), Buffer.from(b64, "base64")); console.log("image", t);
    }
  } else {
    const sortie = resolve(a ?? `${format}.mp4`);
    const suivi = setInterval(async () => { try { console.log("avancement", await ev("window.avancement ?? '…'", false)); } catch {} }, 10000);
    const taille = await ev("window.produire()");
    clearInterval(suivi);
    const morceaux = []; for (let i = 0; i < taille; i += 3_000_000) morceaux.push(Buffer.from(await ev(`window.tranche(${i}, 3000000)`, false), "base64"));
    writeFileSync(sortie, Buffer.concat(morceaux)); console.log("écrit", sortie, taille);
  }
  ws.close();
} finally { chrome.kill(); serveur.close(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
