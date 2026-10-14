"use client";

import { useEffect, useState } from "react";

/**
 * L'état du réseau.
 *
 * On part de `true` et on corrige au montage : `navigator.onLine` n'existe pas
 * pendant le rendu serveur, et afficher « hors connexion » à quelqu'un qui est
 * connecté est plus grave que l'inverse.
 *
 * `navigator.onLine` ment dans un sens : il dit « en ligne » dès qu'une
 * interface réseau existe, même sans accès réel. Il ne ment jamais dans
 * l'autre — un `false` est fiable, et c'est ce dont on se sert.
 */
export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(true);

  useEffect(() => {
    const majuscule = () => setEnLigne(navigator.onLine);
    majuscule();
    window.addEventListener("online", majuscule);
    window.addEventListener("offline", majuscule);
    return () => {
      window.removeEventListener("online", majuscule);
      window.removeEventListener("offline", majuscule);
    };
  }, []);

  return enLigne;
}
