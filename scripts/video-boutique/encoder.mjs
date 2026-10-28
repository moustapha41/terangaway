// Encode une séquence d'images (capturer.mjs) en MP4.   DEBIT=14000000 node encoder.mjs <dossier-images> <sortie.mp4>
import { spawn } from "node:child_process"; import { createServer } from "node:http"; import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve, extname } from "node:path";
const [dossier, sortie] = process.argv.slice(2); const racine = import.meta.dirname, images = resolve(dossier), video4k = resolve(racine, "../video-4k");
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg" };
const serveur = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const chemin = p.startsWith("/images/") ? join(images, p.slice(8)) : p.startsWith("/video-4k/") ? join(video4k, p.slice(10)) : join(racine, p === "/" ? "encoder.html" : p.slice(1));
  if (!existsSync(chemin)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(chemin)] ?? "application/octet-stream" }).end(readFileSync(chemin));
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r)); const port = serveur.address().port;
const profil = mkdtempSync(join(tmpdir(), "enc-")); const PORT_CDP = 9391;
const chrome = spawn("google-chrome-stable", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
try {
  const cible = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl); let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, attendre = true) => { const r = await cmd("Runtime.evaluate", { expression, awaitPromise: attendre, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result?.result?.value; };
  await cmd("Page.enable"); await cmd("Runtime.enable"); await cmd("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  for (let i = 0; i < 60 && !(await ev("window.pret === true", false)); i++) await new Promise((r) => setTimeout(r, 1000));
  console.log("images", JSON.stringify(await ev("window.infos", false)));
  const suivi = setInterval(async () => { try { console.log("avancement", await ev("window.avancement ?? '…'", false)); } catch {} }, 10000);
  const taille = await ev(`window.produire(${process.env.DEBIT ?? 14000000})`); clearInterval(suivi);
  const morceaux = []; for (let i = 0; i < taille; i += 3_000_000) morceaux.push(Buffer.from(await ev(`window.tranche(${i}, 3000000)`, false), "base64"));
  writeFileSync(resolve(sortie), Buffer.concat(morceaux)); console.log("écrit", sortie, taille); ws.close();
} finally { chrome.kill(); serveur.close(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
