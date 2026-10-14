"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

/**
 * Champ de texte — dossier de conception §C.3.
 * États : vide, rempli, actif, erreur, désactivé.
 *
 * Deux règles d'accessibilité (§C.6) que ce composant impose plutôt que de les
 * rappeler : le libellé est toujours visible, et l'erreur est **écrite** sous le
 * champ — jamais seulement signalée par du rouge.
 */
export interface ChampProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  libelle: string;
  /** Texte d'aide sous le champ. Remplacé par l'erreur quand il y en a une. */
  aide?: ReactNode;
  erreur?: ReactNode;
  icone?: NomIcone;
  /** Chiffres à largeur fixe : prix, dates, codes (§A.5). */
  tabulaire?: boolean;
}

export function Champ({
  libelle,
  aide,
  erreur,
  icone,
  tabulaire,
  className,
  disabled,
  ...reste
}: ChampProps) {
  const id = useId();
  const idAide = `${id}-aide`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-petit text-encre">
        {libelle}
      </label>

      <div
        className={cn(
          "flex min-h-[var(--size-control)] items-center gap-2 rounded-control border px-3",
          "transition-colors duration-[var(--duree-fast)]",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primaire",
          // Une seule branche décide fond et bordure : deux classes de même poids
          // laisseraient l'ordre de la feuille trancher à notre place.
          disabled
            ? "border-contour-champ bg-champ"
            : erreur
              ? "border-danger bg-surface"
              : "border-contour-champ bg-surface",
        )}
      >
        {icone && <Icone nom={icone} taille={20} className="shrink-0 text-encre-douce" />}
        <input
          id={id}
          disabled={disabled}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur || aide ? idAide : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-corps text-encre outline-none",
            "placeholder:text-encre-douce disabled:cursor-not-allowed disabled:text-encre-douce",
            tabulaire && "chiffres-tabulaires",
            className,
          )}
          {...reste}
        />
      </div>

      {(erreur || aide) && (
        <p id={idAide} className={cn("text-petit", erreur ? "text-danger" : "text-encre-douce")}>
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}
