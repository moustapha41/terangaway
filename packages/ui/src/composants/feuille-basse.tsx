"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../cn";
import { Icone } from "../icones";

/**
 * Feuille basse — filtres, calendrier, confirmation (§C.3).
 * Monte du bas, poignée, bouton de fermeture. États : ouverte, fermée.
 *
 * Bâtie sur `<dialog>` : le navigateur fournit le piège au clavier, la fermeture
 * par Échap et le fond inerte. Les réécrire à la main, c'est les réécrire mal.
 */
export function FeuilleBasse({
  ouverte,
  onFermer,
  titre,
  etiquetteFermer,
  children,
  className,
}: {
  ouverte: boolean;
  onFermer: () => void;
  titre: string;
  etiquetteFermer: string;
  children: ReactNode;
  className?: string;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialogue.current;
    if (!element) return;
    if (ouverte && !element.open) element.showModal();
    if (!ouverte && element.open) element.close();
  }, [ouverte]);

  return (
    <dialog
      ref={dialogue}
      onClose={onFermer}
      onClick={(e) => e.currentTarget === e.target && onFermer()}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-card bg-surface p-0",
        "backdrop:bg-primaire/50 sm:mx-auto sm:mb-auto sm:mt-auto sm:max-w-[560px] sm:rounded-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-contour px-5 py-4">
        {/* La poignée est décorative : la fermeture passe par le bouton et par Échap. */}
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-pill bg-contour sm:hidden" />
        <h2 className="text-titre-3 text-encre">{titre}</h2>
        <button
          type="button"
          onClick={onFermer}
          aria-label={etiquetteFermer}
          className="flex h-[var(--size-touch)] w-[var(--size-touch)] shrink-0 items-center justify-center rounded-pill text-encre-douce hover:bg-champ"
        >
          <Icone nom="fermeture" taille={24} />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </dialog>
  );
}
