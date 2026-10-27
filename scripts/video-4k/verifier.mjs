// Relit une vidéo produite : dimensions, durée, et quelques images (réduites) pour contrôle.
// Usage : node verifier.mjs <video.mp4> <dossier-images> t1,t2,…
import { spawn } from "node:child_process"; import { createServer } from "node:http"; import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, statSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve } from "node:path";
const [video, dossier, temps] = process.argv.slice(2); mkdirSync(resolve(dossier), { recursive: true });
const fichier = resolve(video);
const serveur = createServer((req, res) => {
  if (req.url.startsWith("/v.mp4")) {
    const taille = statSync(fichier).size, plage = req.headers.range;
    if (plage) { const [d, f] = plage.replace("bytes=", "").split("-"); const a = +d, b = f ? +f : taille - 1; res.writeHead(206, { "Content-Type": "video/mp4", "Content-Range": `bytes ${a}-${b}/${taille}`, "Accept-Ranges": "bytes", "Content-Length": b - a + 1 }); import("node:fs").then(({ createReadStream }) => createReadStream(fichier, { start: a, end: b }).pipe(res)); }
    else { res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": taille, "Accept-Ranges": "bytes" }); import("node:fs").then(({ createReadStream }) => createReadStream(fichier).pipe(res)); }
  } else res.writeHead(200, { "Content-Type": "text/html" }).end(`<video id=v src="/v.mp4" muted preload=auto></video><script>const v=document.getElementById('v');window.info=new Promise(r=>v.onloadedmetadata=()=>r({d:v.duration,w:v.videoWidth,h:v.videoHeight}));window.cherche=t=>new Promise(r=>{v.onseeked=()=>r();v.currentTime=t});</script>`);
});
await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
const profil = mkdtempSync(join(tmpdir(), "v4k-"));
const chrome = spawn("google-chrome-stable", ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9380", `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
try {
  const cible = await (await fetch(`http://127.0.0.1:9380/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl); let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await cmd("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await cmd("Page.enable"); await cmd("Page.navigate", { url: `http://127.0.0.1:${serveur.address().port}/` }); await new Promise((r) => setTimeout(r, 3000));
  console.log(JSON.stringify(await ev("window.info")));
  for (const t of temps.split(",")) {
    const b = await ev(`(async()=>{await cherche(${parseFloat(t)}); const r=${"v.videoWidth"}>v.videoHeight?[1920,1080]:[1080,1920]; const c=document.createElement('canvas'); c.width=r[0]; c.height=r[1]; c.getContext('2d').drawImage(v,0,0,r[0],r[1]); return c.toDataURL('image/jpeg',0.85).split(',')[1]})()`);
    writeFileSync(join(resolve(dossier), `v${t}.jpg`), Buffer.from(b, "base64")); console.log("image", t);
  }
  ws.close();
} finally { chrome.kill(); serveur.close(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
