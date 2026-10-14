"use client";

import { Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { useEnLigne } from "./etat-reseau";

/**
 * Bandeau hors connexion — « bandeau en haut : Vous êtes hors connexion » (§B.7).
 *
 * Il est annoncé par `role="status"` : quelqu'un qui n'a pas l'écran sous les
 * yeux doit savoir que ses envois ne partiront pas.
 */
export function BandeauHorsLigne() {
  const t = useT();
  const enLigne = useEnLigne();

  if (enLigne) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-encre px-4 py-2 text-petit font-semibold text-white"
    >
      <Icone nom="hors-connexion" taille={20} />
      {t("horsLigne.bandeau")}
    </div>
  );
}
