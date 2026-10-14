"use client";

import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

/**
 * Puce de filtre — type, budget, équipements (§C.3). Inactive ou active.
 * Zone cliquable d'au moins 44 px, espacée de 8 px de sa voisine (§C.6).
 */
export function PuceFiltre({
  libelle,
  active = false,
  icone,
  onClick,
  className,
}: {
  libelle: string;
  active?: boolean;
  icone?: NomIcone;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[var(--size-touch)] items-center gap-2 rounded-pill border px-4",
        "text-petit font-semibold transition-colors duration-[var(--duree-fast)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire",
        active
          ? "border-primaire bg-primaire text-white"
          : "border-contour-champ bg-surface text-encre hover:border-primaire/40",
        className,
      )}
    >
      {icone && <Icone nom={icone} taille={16} />}
      {libelle}
    </button>
  );
}
