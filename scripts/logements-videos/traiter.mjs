// Retire la bande son d'une vidéo de visite (re-encodage H.264) et en tire des images fixes.
//   DEBIT=900000 node traiter.mjs <source.mp4> <sortie.mp4> [<dossier-images> <fraction,fraction,…>]
import { spawn } from "node:child_process"; import { createServer } from "node:http"; import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve, extname } from "node:path";
const [source, sortie, dossierImages, fractions] = process.argv.slice(2);
const racine = import.meta.dirname, video4k = resolve(racine, "../video-4k");
const TYPES = { ".html": "text/html", ".mjs": "text/javascript" };
const serveur = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/source.mp4") {
    const d = readFileSync(resolve(source)); const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (!m) { res.writeHead(200, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": d.length }).end(d); return; }
    const a = m[1] ? parseInt(m[1]) : 0, b = m[2] ? Math.min(parseInt(m[2]), d.length - 1) : d.length - 1;
    res.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${d.length}`, "Content-Length": b - a + 1 }).end(d.subarray(a, b + 1)); return;
  }
  const chemin = p.startsWith("/video-4k/") ? join(video4k, p.slice(10)) : join(racine, p === "/" ? "traiter.html" : p.slice(1));
  if (!existsSync(chemin)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(chemin)] ?? "application/octet-stream" }).end(readFileSync(chemin));
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r)); const port = serveur.address().port;
const profil = mkdtempSync(join(tmpdir(), "lgv-")); const PORT_CDP = 9400 + Math.floor(Math.random() * 90);
const chrome = spawn("google-chrome-stable", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
try {
  const cible = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl); let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, attendre = true) => { const r = await cmd("Runtime.evaluate", { expression, awaitPromise: attendre, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); return r.result?.result?.value; };
  await cmd("Page.enable"); await cmd("Runtime.enable"); await cmd("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  for (let i = 0; i < 60 && !(await ev("window.pret === true", false)); i++) await new Promise((r) => setTimeout(r, 1000));
  const infos = await ev("window.infos", false); console.log("source", JSON.stringify(infos));
  if (dossierImages) {
    mkdirSync(resolve(dossierImages), { recursive: true });
    const jpgs = await ev(`window.images(${JSON.stringify(fractions.split(",").map(Number))})`);
    jpgs.forEach((b, i) => writeFileSync(join(resolve(dossierImages), `${String(i + 1).padStart(2, "0")}.jpg`), Buffer.from(b, "base64"))); console.log("images", jpgs.length);
  }
  if (sortie !== "-") {
    const suivi = setInterval(async () => { try { console.log("avancement", await ev("window.avancement ?? '…'", false)); } catch {} }, 20000);
    const taille = await ev(`window.produire(${process.env.DEBIT ?? 900000})`); clearInterval(suivi);
    const morceaux = []; for (let i = 0; i < taille; i += 3_000_000) morceaux.push(Buffer.from(await ev(`window.tranche(${i}, 3000000)`, false), "base64"));
    mkdirSync(resolve(sortie, ".."), { recursive: true }); writeFileSync(resolve(sortie), Buffer.concat(morceaux)); console.log("écrit", sortie, taille, "octets,", infos.duree.toFixed(1), "s");
  }
  ws.close();
} finally { chrome.kill(); serveur.close(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
