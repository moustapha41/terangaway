// Enregistre l'animation en temps réel, dans Chrome, et écrit le fichier vidéo.
// Usage : node enregistrer.mjs <dossier-de-sortie>
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const sortie = resolve(process.argv[2] ?? ".");
const profil = mkdtempSync(join(tmpdir(), "enreg-"));
const chrome = spawn("google-chrome-stable", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files",
  "--window-size=1920,1080", "--remote-debugging-port=9347", `--user-data-dir=${profil}`,
  "--autoplay-policy=no-user-gesture-required", "about:blank",
], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
try {
  const cible = await (await fetch(`http://127.0.0.1:9347/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd("Page.enable");
  await cmd("Page.navigate", { url: `file://${resolve(import.meta.dirname, "index.html")}` });
  await new Promise((r) => setTimeout(r, 2500));
  const rep = await cmd("Runtime.evaluate", { expression: "window.enregistrer()", awaitPromise: true, returnByValue: true, timeout: 120000 });
  const { mime, taille } = rep.result.result.value;
  // Le fichier revient par tranches : un seul message de plusieurs dizaines de
  // mégaoctets dépasse ce que le WebSocket de débogage accepte.
  let base64 = "";
  for (let i = 0; i < taille; i += 2_000_000) {
    const t = await cmd("Runtime.evaluate", { expression: `window.__b64.slice(${i}, ${i + 2_000_000})`, returnByValue: true });
    base64 += t.result.result.value;
  }
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const fichier = join(sortie, `accompagnement.${ext}`);
  writeFileSync(fichier, Buffer.from(base64, "base64"));
  console.log(mime, fichier);
  ws.close();
} finally { chrome.kill(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
