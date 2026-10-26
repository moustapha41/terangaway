import { spawn } from "node:child_process"; import { mkdtempSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const S = process.env.S;
const profil = mkdtempSync(join(tmpdir(), "cap-"));
const chrome = spawn("google-chrome-stable", ["--headless=new","--no-sandbox","--disable-gpu","--remote-debugging-port=9353",`--user-data-dir=${profil}`,"about:blank"],{stdio:"ignore"});
await new Promise(r=>setTimeout(r,4000));
const cible = await (await fetch(`http://127.0.0.1:9353/json/new?${encodeURIComponent("about:blank")}`,{method:"PUT"})).json();
const ws=new WebSocket(cible.webSocketDebuggerUrl); let n=0; const att=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&att.has(m.id)){att.get(m.id)(m);att.delete(m.id);}};
await new Promise(o=>ws.onopen=o);
const cmd=(method,params={})=>new Promise(o=>{const i=++n;att.set(i,o);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>(await cmd("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const shot=async(nom,haut)=>{ const p={format:"png"}; if(haut){p.captureBeyondViewport=true;p.clip={x:0,y:0,width:390,height:haut,scale:1};} const r=await cmd("Page.captureScreenshot",p); writeFileSync(`${S}/ecrans/${nom}.png`,Buffer.from(r.result.data,"base64")); };
await cmd("Page.enable"); await cmd("Network.enable");
await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none !important}";document.head.appendChild(s)})`});
const rects={};
const rect=(nom,txt,sel="button,a,input",vp=false)=>ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>${txt?"x.textContent.includes("+JSON.stringify(txt)+")":"true"}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left,y:r.top+(${vp}?0:scrollY),w:r.width,h:r.height}})()`).then(v=>{rects[nom]=v;});
await cmd("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2,mobile:true});
const go=async(u,ms=4500)=>{await cmd("Page.navigate",{url:u}); await pause(ms);};
const B="http://localhost:3000/fr";
const clic=(txt)=>ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes(${JSON.stringify(txt)})); if(!b) return 'introuvable'; b.click(); return 'ok'})()`);
const remplir=(sel,val)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'x'; const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(e,${JSON.stringify(val)}); e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'})()`);

// 1. la fiche
await go(`${B}/logements/villa-somone-cinq-chambres?debut=2026-11-01&fin=2026-11-08`);
await shot("a-fiche-haut"); await rect("fiche-btn","Demander ce logement");
console.log("btn", await ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes('Demander ce logement')); if(!b) return null; const r=b.getBoundingClientRect(); return JSON.stringify({y:r.top+scrollY, h:r.height})})()`));
await ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes('Demander ce logement')); b&&b.scrollIntoView({block:'center'})})()`); await pause(800);
await shot("b-fiche-reservation");
// 2. le formulaire
await go(`${B}/demande/l-009?debut=2026-11-01&fin=2026-11-08`);
await shot("c-demande-haut", await ev("document.documentElement.scrollHeight")); await rect("nom",null,'input[name="nom"]'); await rect("email",null,'input[name="email"]'); await rect("tel",null,'#demande-telephone'); await rect("semaine","1 semaine"); await rect("continuer","Continuer");
console.log("champs", await ev(`JSON.stringify([...document.querySelectorAll('input')].map(i=>i.name||i.id||i.type))`));
await remplir('input[name="nom"]',"Aminata Diallo"); await remplir('input[name="email"]',"aminata@exemple.com"); await remplir('#demande-telephone',"77 123 45 67");
await pause(500);
const h = await ev("document.documentElement.scrollHeight"); console.log("h demande", h);
await shot("d-demande-remplie", Math.min(2400, h));
// 3. la confirmation + popup (demande réelle)
const r = await (await fetch("http://localhost:3001/demandes/logement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({logementId:"l-009",debut:"2026-11-01",fin:"2026-11-08",personnes:3,contact:{email:"video.demo@exemple.sn",nom:"Aminata Diallo"}})})).json();
writeFileSync(`${S}/demo.json`,JSON.stringify({id:r.donnees.id}));
const recap={id:r.donnees.id,reference:r.donnees.reference,titre:"Villa 5 chambres à Somone",logementId:"l-009",debut:"2026-11-01",fin:"2026-11-08",personnes:3,statut:"envoyee",emailEnvoye:true,acompteAnnonce:false,jetonSuite:r.notification.jetonSuite};
await cmd("Network.setCookie",{name:"teranga_recap",value:encodeURIComponent(JSON.stringify(recap)),domain:"localhost",path:"/"});
await go(`${B}/demande/confirmation?reference=${recap.reference}`,5500);
await shot("e-confirmation-popup"); await rect("oui","Oui, je veux une voiture","dialog button",true); await rect("plustard","Répondre plus tard","dialog button",true);
console.log("oui", await clic("Oui, je veux une voiture")); await pause(2500);
await shot("f-popup-oui"); await rect("vol","Envoyer mon numéro de vol","dialog a",true); await rect("cont","Continuer","dialog button",true);
console.log("cont", await clic("Continuer")); await pause(900);
await shot("g-confirmation-apres");
writeFileSync(`${S}/ecrans/rects.json`,JSON.stringify(rects,null,1)); ws.close(); chrome.kill();
