// Chrome headless piloté par CDP : un onglet, quelques commandes.
import { spawn } from "node:child_process"; import { mkdtempSync, rmSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
export async function ouvrir({ largeur, hauteur, echelle = 1, port = 9390, mobile = false }) {
  const profil = mkdtempSync(join(tmpdir(), "boutique-"));
  const chrome = spawn("google-chrome-stable", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 4000));
  const cible = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(cible.webSocketDebuggerUrl); let n = 0; const att = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m); att.delete(m.id); } };
  await new Promise((o) => (ws.onopen = o));
  const cmd = (method, params = {}) => new Promise((o) => { const i = ++n; att.set(i, o); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, attendre = true) => { const r = await cmd("Runtime.evaluate", { expression, awaitPromise: attendre, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); return r.result?.result?.value; };
  await cmd("Page.enable"); await cmd("Runtime.enable");
  await cmd("Emulation.setDeviceMetricsOverride", { width: largeur, height: hauteur, deviceScaleFactor: echelle, mobile });
  if (mobile) { await cmd("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36" }); await cmd("Emulation.setTouchEmulationEnabled", { enabled: true }); }
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const aller = async (url) => { await cmd("Page.navigate", { url }); await attendre(1500); for (let i = 0; i < 40 && (await ev("document.readyState")) !== "complete"; i++) await attendre(250); };
  const photo = async (qualite = 90) => Buffer.from((await cmd("Page.captureScreenshot", { format: "jpeg", quality: qualite })).result.data, "base64");
  const fermer = () => { try { ws.close(); } catch {} chrome.kill(); try { rmSync(profil, { recursive: true, force: true, maxRetries: 5 }); } catch {} };
  return { cmd, ev, attendre, aller, photo, fermer };
}
