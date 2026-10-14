"use client";

import { useId } from "react";
import { cn } from "../cn";
import { Icone } from "../icones";

export interface Lieu {
  valeur: string;
  /** Précision affichée à côté : quartier, ville, « aéroport »… */
  detail?: string;
}

/**
 * Sélecteur de lieu — liste de lieux connus, puis saisie libre (§C.3).
 * États : vide, suggestions, choisi.
 *
 * Bâti sur `<datalist>`. Le navigateur fournit la liste, le filtrage au clavier
 * et la saisie libre, sur mobile comme sur ordinateur, sans JavaScript. Une
 * liste déroulante maison serait plus jolie et moins fiable.
 */
export function SelecteurLieu({
  libelle,
  nom,
  lieux,
  valeur,
  onChange,
  placeholder,
  aide,
  erreur,
  requis,
  className,
}: {
  libelle: string;
  nom: string;
  lieux: Lieu[];
  valeur?: string;
  onChange?: (valeur: string) => void;
  placeholder?: string;
  aide?: string;
  erreur?: string;
  requis?: boolean;
  className?: string;
}) {
  const id = useId();
  const idListe = `${id}-lieux`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-petit text-encre">
        {libelle}
      </label>

      <div
        className={cn(
          "flex min-h-[var(--size-control)] items-center gap-2 rounded-control border px-3",
          "bg-surface transition-colors duration-[var(--duree-fast)]",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primaire",
          erreur ? "border-danger" : "border-contour-champ",
        )}
      >
        <Icone nom="repere" taille={20} className="shrink-0 text-encre-douce" />
        <input
          id={id}
          name={nom}
          list={idListe}
          required={requis}
          value={valeur}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur || aide ? `${id}-aide` : undefined}
          className="min-w-0 flex-1 bg-transparent text-corps text-encre outline-none placeholder:text-encre-douce"
        />
      </div>

      <datalist id={idListe}>
        {lieux.map((lieu) => (
          <option key={lieu.valeur} value={lieu.valeur}>
            {lieu.detail}
          </option>
        ))}
      </datalist>

      {(erreur || aide) && (
        <p id={`${id}-aide`} className={cn("text-petit", erreur ? "text-danger" : "text-encre-douce")}>
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}
