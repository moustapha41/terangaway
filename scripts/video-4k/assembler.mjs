// Monte deux vidéos 9:16 4K bout à bout, avec accélérés et fondus.
//   DEBIT=16000000 node assembler.mjs <a.mp4> <b.mp4> <plan.json> <sortie.mp4>
import { spawn } from "node:child_process"; import { createServer } from "node:http"; import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve, extname } from "node:path";
const [srcA, srcB, plan, sortie] = process.argv.slice(2); const planJson = readFileSync(resolve(plan), "utf8");
const racine = import.meta.dirname, TYPES = { ".html": "text/html", ".mjs": "text/javascript" };
const serveur = createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (p === "/a.mp4" || p === "/b.mp4") {
    const d = readFileSync(resolve(p === "/a.mp4" ? srcA : srcB)); const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (!m) { res.writeHead(200, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": d.length }).end(d); return; }
    const a = m[1] ? parseInt(m[1]) : 0, b = m[2] ? Math.min(parseInt(m[2]), d.length - 1) : d.length - 1;
    res.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${d.length}`, "Content-Length": b - a + 1 }).end(d.subarray(a, b + 1)); return;
  }
  const chemin = resolve(racine, "." + p === "./" ? "./assembler.html" : "." + p);
  if (!chemin.startsWith(racine) || !existsSync(chemin)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(chemin)] ?? "application/octet-stream" }).end(readFileSync(chemin));
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r)); const port = serveur.address().port;
const profil = mkdtempSync(join(tmpdir(), "asm-")); const PORT_CDP = 9381;
const chrome = spawn("google-chrome-stable", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
try {
  const cible = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl); let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, attendre = true) => { const r = await cmd("Runtime.evaluate", { expression, awaitPromise: attendre, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result?.result?.value; };
  await cmd("Page.enable"); await cmd("Runtime.enable");
  await cmd("Page.navigate", { url: `http://127.0.0.1:${port}/assembler.html?plan=${encodeURIComponent(planJson)}` });
  for (let i = 0; i < 60 && !(await ev("window.pret === true", false)); i++) await new Promise((r) => setTimeout(r, 1000));
  console.log("source", JSON.stringify(await ev("window.infos", false)));
  const suivi = setInterval(async () => { try { console.log("avancement", await ev("window.avancement ?? '…'", false)); } catch {} }, 10000);
  const taille = await ev(`window.produire(${process.env.DEBIT ?? 12000000})`); clearInterval(suivi);
  const morceaux = []; for (let i = 0; i < taille; i += 3_000_000) morceaux.push(Buffer.from(await ev(`window.tranche(${i}, 3000000)`, false), "base64"));
  writeFileSync(resolve(sortie), Buffer.concat(morceaux)); console.log("écrit", sortie, taille);
  ws.close();
} finally { chrome.kill(); serveur.close(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
