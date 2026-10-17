"use client";

import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

export interface Onglet<T extends string> {
  cle: T;
  libelle: string;
  icone?: NomIcone;
}

/**
 * Onglets — « une seule étape de recherche change entre logement et transport »
 * (§B.1). Sémantique d'onglets complète : le lecteur d'écran annonce la position
 * et le nombre, la flèche gauche/droite déplace la sélection.
 */
export function Onglets<T extends string>({
  onglets,
  actif,
  onChange,
  etiquette,
  className,
}: {
  onglets: ReadonlyArray<Onglet<T>>;
  actif: T;
  onChange: (cle: T) => void;
  /** Ce que la liste d'onglets représente, pour les lecteurs d'écran. */
  etiquette: string;
  className?: string;
}) {
  const deplacer = (delta: number) => {
    const i = onglets.findIndex((o) => o.cle === actif);
    const suivant = onglets[(i + delta + onglets.length) % onglets.length];
    onChange(suivant.cle);
  };

  return (
    <div
      role="tablist"
      aria-label={etiquette}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") deplacer(1);
        if (e.key === "ArrowLeft") deplacer(-1);
      }}
      className={cn(
        "flex max-w-full overflow-x-auto rounded-control [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {onglets.map((onglet) => {
        const selectionne = onglet.cle === actif;
        return (
          <button
            key={onglet.cle}
            type="button"
            role="tab"
            aria-selected={selectionne}
            tabIndex={selectionne ? 0 : -1}
            onClick={() => onChange(onglet.cle)}
            className={cn(
              "flex min-h-[var(--size-control)] shrink-0 items-center justify-center gap-2 px-4 sm:px-5",
              "text-bouton transition-colors duration-[var(--duree-fast)]",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primaire",
              selectionne ? "bg-primaire text-white" : "bg-champ text-encre hover:bg-contour/60",
            )}
          >
            {onglet.icone && <Icone nom={onglet.icone} taille={20} />}
            {onglet.libelle}
          </button>
        );
      })}
    </div>
  );
}
