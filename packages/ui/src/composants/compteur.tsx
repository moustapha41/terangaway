"use client";

import { cn } from "../cn";
import { Icone } from "../icones";

/**
 * Compteur — personnes, bagages (§C.3). États : minimum atteint, maximum atteint.
 * Boutons de 44 px (§C.6). La valeur est annoncée aux lecteurs d'écran à chaque
 * changement, sinon seul le bouton parle et le chiffre reste muet.
 */
export function Compteur({
  libelle,
  valeur,
  min = 0,
  max = 99,
  onChange,
  className,
}: {
  libelle: string;
  valeur: number;
  min?: number;
  max?: number;
  onChange: (valeur: number) => void;
  className?: string;
}) {
  const auMin = valeur <= min;
  const auMax = valeur >= max;

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="text-corps text-encre">{libelle}</span>

      <div className="flex items-center gap-2">
        <Pas
          sens="moins"
          libelle={`Retirer : ${libelle}`}
          desactive={auMin}
          onClick={() => onChange(valeur - 1)}
        />
        <output aria-live="polite" className="w-8 text-center text-corps font-semibold text-encre chiffres-tabulaires">
          {valeur}
        </output>
        <Pas
          sens="plus"
          libelle={`Ajouter : ${libelle}`}
          desactive={auMax}
          onClick={() => onChange(valeur + 1)}
        />
      </div>
    </div>
  );
}

function Pas({
  sens,
  libelle,
  desactive,
  onClick,
}: {
  sens: "moins" | "plus";
  libelle: string;
  desactive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={libelle}
      className={cn(
        "flex h-[var(--size-touch)] w-[var(--size-touch)] items-center justify-center",
        "rounded-pill border border-contour-champ text-encre transition-colors duration-[var(--duree-fast)]",
        "hover:border-primaire/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire",
        "disabled:cursor-not-allowed disabled:border-contour-champ disabled:text-encre-douce disabled:hover:border-contour-champ",
      )}
    >
      <Icone nom={sens} taille={20} />
    </button>
  );
}
