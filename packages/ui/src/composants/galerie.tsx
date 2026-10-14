"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Icone } from "../icones";

export interface PhotoGalerie {
  url: string;
  alt: string;
}

/**
 * Galerie — dossier de conception §C.3 : défilement horizontal, compteur « 2 / 8 »,
 * plein écran au toucher. États : une photo, plusieurs, chargement.
 *
 * Le défilement est natif, avec accrochage : il garde l'inertie du système et
 * reste utilisable sans JavaScript. Les flèches ne sont qu'un raccourci, elles
 * disparaissent pour un lecteur d'écran qui a déjà la liste des photos.
 *
 * Le composant ne connaît ni `next/image` ni le routeur : il reçoit ses images
 * déjà rendues, pour que `@teranga/ui` reste utilisable hors de l'application.
 */
export function Galerie({
  photos,
  rendreImage,
  etiquette,
  etiquetteCompteur,
  etiquettePrecedente,
  etiquetteSuivante,
  etiquettePleinEcran,
  etiquetteFermer,
  className,
}: {
  photos: PhotoGalerie[];
  /** Rend une photo ; l'application passe son `next/image`. */
  rendreImage: (photo: PhotoGalerie, index: number) => ReactNode;
  etiquette: string;
  /** Gabarit du compteur, par exemple « {index} / {total} ». */
  etiquetteCompteur: (index: number, total: number) => string;
  etiquettePrecedente: string;
  etiquetteSuivante: string;
  etiquettePleinEcran: string;
  etiquetteFermer: string;
  className?: string;
}) {
  const piste = useRef<HTMLUListElement>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const [courante, setCourante] = useState(0);

  const total = photos.length;

  const allerA = (index: number) => {
    const borne = Math.max(0, Math.min(total - 1, index));
    const element = piste.current?.children[borne] as HTMLElement | undefined;
    element?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setCourante(borne);
  };

  const surDefilement = () => {
    const boite = piste.current;
    if (!boite) return;
    setCourante(Math.round(boite.scrollLeft / boite.clientWidth));
  };

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={piste}
        onScroll={surDefilement}
        aria-label={etiquette}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <li key={photo.url + i} className="relative w-full shrink-0 snap-start">
            <button
              type="button"
              onClick={() => dialogue.current?.showModal()}
              aria-label={etiquettePleinEcran}
              className="block w-full cursor-zoom-in"
            >
              {rendreImage(photo, i)}
            </button>
          </li>
        ))}
      </ul>

      {total > 1 && (
        <>
          <Fleche
            cote="gauche"
            etiquette={etiquettePrecedente}
            desactive={courante === 0}
            onClick={() => allerA(courante - 1)}
          />
          <Fleche
            cote="droite"
            etiquette={etiquetteSuivante}
            desactive={courante === total - 1}
            onClick={() => allerA(courante + 1)}
          />

          {/* Le compteur est annoncé : sans lui, un lecteur d'écran ne sait pas où il est. */}
          <p
            aria-live="polite"
            className="absolute bottom-3 right-3 rounded-pill bg-primaire/85 px-3 py-1 text-petit font-semibold text-white chiffres-tabulaires"
          >
            {etiquetteCompteur(courante + 1, total)}
          </p>
        </>
      )}

      <dialog
        ref={dialogue}
        onClick={(e) => e.currentTarget === e.target && dialogue.current?.close()}
        className="m-0 h-full max-h-none w-full max-w-none bg-primaire/95 p-0 backdrop:bg-primaire/80"
      >
        <button
          type="button"
          onClick={() => dialogue.current?.close()}
          aria-label={etiquetteFermer}
          className="absolute right-4 top-4 z-10 flex h-[var(--size-touch)] w-[var(--size-touch)] items-center justify-center rounded-pill bg-white/15 text-white"
        >
          <Icone nom="fermeture" taille={24} />
        </button>
        <ul className="flex h-full snap-x snap-mandatory items-center overflow-x-auto">
          {photos.map((photo, i) => (
            <li key={photo.url + i} className="flex h-full w-full shrink-0 snap-start items-center">
              {rendreImage(photo, i)}
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}

function Fleche({
  cote,
  etiquette,
  desactive,
  onClick,
}: {
  cote: "gauche" | "droite";
  etiquette: string;
  desactive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={etiquette}
      className={cn(
        "absolute top-1/2 hidden h-[var(--size-touch)] w-[var(--size-touch)] -translate-y-1/2",
        "items-center justify-center rounded-pill bg-surface/90 text-encre shadow-sm",
        "transition-opacity duration-[var(--duree-fast)] disabled:opacity-0 sm:flex",
        cote === "gauche" ? "left-3" : "right-3",
      )}
    >
      <Icone nom={cote === "gauche" ? "chevron-gauche" : "chevron-droite"} taille={24} />
    </button>
  );
}
