"use client";

import { useCallback, useEffect, useState } from "react";

export interface Preferences {
  notificationsPush: boolean;
  notificationsEmail: boolean;
}

const DEFAUTS: Preferences = {
  notificationsPush: true,
  notificationsEmail: true,
};

const CLE = "teranga_preferences_2";

/**
 * Préférences du visiteur, dans le navigateur.
 *
 * Elles n'ont pas besoin de compte et n'ont pas encore de serveur. Chaque accès
 * à `localStorage` est protégé : en navigation privée il peut lever, et
 * l'absence de préférences est un état normal, pas une erreur.
 *
 * Un événement maison prévient les autres composants de la page : sans lui, le
 * prix converti d'un écran ne suivrait pas un changement fait dans les réglages
 * d'un autre.
 */
const EVENEMENT = "teranga:preferences";

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAUTS);

  useEffect(() => {
    const lire = () => {
      try {
        const brut = window.localStorage.getItem(CLE);
        if (brut) setPreferences({ ...DEFAUTS, ...(JSON.parse(brut) as Partial<Preferences>) });
      } catch {
        /* stockage indisponible : on garde les valeurs par défaut */
      }
    };
    lire();
    window.addEventListener(EVENEMENT, lire);
    window.addEventListener("storage", lire);
    return () => {
      window.removeEventListener(EVENEMENT, lire);
      window.removeEventListener("storage", lire);
    };
  }, []);

  const modifier = useCallback((partiel: Partial<Preferences>) => {
    setPreferences((actuelles) => {
      const suivantes = { ...actuelles, ...partiel };
      try {
        window.localStorage.setItem(CLE, JSON.stringify(suivantes));
      } catch {
        /* on garde quand même le choix pour la session */
      }
      window.dispatchEvent(new Event(EVENEMENT));
      return suivantes;
    });
  }, []);

  return { preferences, modifier };
}
