"use client";

import { useCallback, useEffect, useState } from "react";

const CLE = "teranga_favoris";

/**
 * Les favoris, dans le navigateur.
 *
 * Ils n'ont pas besoin de compte — le §B.1 veut que tout se consulte librement —
 * et pas encore de serveur. `localStorage` peut échouer (navigation privée,
 * stockage bloqué) : chaque accès est protégé, et l'absence de favoris est un
 * état normal, pas une erreur.
 */
export function useFavoris() {
  const [favoris, setFavoris] = useState<string[]>([]);

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE);
      if (brut) setFavoris(JSON.parse(brut) as string[]);
    } catch {
      /* stockage indisponible : on reste sans favoris */
    }
  }, []);

  const basculer = useCallback((id: string) => {
    setFavoris((liste) => {
      const suivant = liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
      try {
        window.localStorage.setItem(CLE, JSON.stringify(suivant));
      } catch {
        /* on garde quand même l'état en mémoire pour la session */
      }
      return suivant;
    });
  }, []);

  return { favoris, basculer, estFavori: (id: string) => favoris.includes(id) };
}
