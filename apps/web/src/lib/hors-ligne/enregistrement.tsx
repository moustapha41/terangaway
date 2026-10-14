"use client";

import { useEffect } from "react";

/**
 * Enregistrement du service worker.
 *
 * Il ne tourne qu'en production : en développement, un cache persistant
 * masquerait les modifications et ferait perdre des heures.
 */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const poser = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Après le chargement : l'installation ne doit pas concurrencer le premier rendu.
    if (document.readyState === "complete") poser();
    else window.addEventListener("load", poser, { once: true });
  }, []);

  return null;
}
