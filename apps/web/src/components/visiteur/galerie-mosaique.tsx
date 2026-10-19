"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { useFavoris } from "@/features/favoris/use-favoris";

/**
 * Galerie en mosaïque — maquette du parcours logement, écran 03.
 *
 * Une grande photo, quatre vignettes, et le reste derrière « +N photos ».
 * Au-dessous de `md`, la mosaïque n'a pas de sens sur une largeur de téléphone :
 * elle redevient une seule photo avec son compteur, et le plein écran prend le
 * relais (écran 08).
 */
export function GalerieMosaique({
  photos,
  logementId,
  verifie,
}: {
  photos: Photo[];
  logementId: string;
  verifie: boolean;
}) {
  const t = useT();
  const { estFavori, basculer } = useFavoris();
  const [courante, setCourante] = useState(0);
  const [pleinEcran, setPleinEcran] = useState<number | null>(null);
  /** La photo réellement sous les yeux en plein écran : le défilement la déplace. */
  const [vue, setVue] = useState(0);
  const dialogue = useRef<HTMLDialogElement>(null);
  const bande = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const element = dialogue.current;
    if (!element) return;
    if (pleinEcran === null) {
      if (element.open) element.close();
      return;
    }
    if (!element.open) element.showModal();

    /**
     * Amener la photo choisie sous les yeux.
     *
     * Sans cela, la bande reste à son point de départ et le plein écran semble
     * figé sur la première image, quelle que soit la vignette cliquée. On
     * attend une image d'animation : avant l'ouverture, la boîte n'a pas de
     * largeur, et un défilement de zéro pixel ne mène nulle part.
     */
    const image = requestAnimationFrame(() => {
      const liste = bande.current;
      if (!liste) return;
      liste.scrollLeft = pleinEcran * liste.clientWidth;
      setVue(pleinEcran);
    });
    return () => cancelAnimationFrame(image);
  }, [pleinEcran]);

  /** Le défilement fait foi : c'est lui qui dit quelle photo est visible. */
  const suivreDefilement = () => {
    const liste = bande.current;
    if (!liste || liste.clientWidth === 0) return;
    const index = Math.round(liste.scrollLeft / liste.clientWidth);
    setVue(Math.min(Math.max(index, 0), photos.length - 1));
  };

  const defiler = (pas: number) => {
    const liste = bande.current;
    if (!liste) return;
    const cible = Math.min(Math.max(vue + pas, 0), photos.length - 1);
    liste.scrollTo({ left: cible * liste.clientWidth, behavior: "smooth" });
    setVue(cible);
  };

  const favori = estFavori(logementId);
  const vignettes = photos.slice(1, 5);
  const reste = Math.max(0, photos.length - 5);

  const decaler = (pas: number) =>
    setCourante((i) => (i + pas + photos.length) % photos.length);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
        {/* grande photo */}
        <div className="relative aspect-[16/11] overflow-hidden rounded-card bg-champ">
          <Image
            src={photos[courante].url}
            alt={photos[courante].alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover"
          />

          {verifie && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-succes px-3 py-1.5 text-petit font-semibold text-white">
              <Icone nom="verification" taille={16} />
              {t("commun.verifie")}
            </span>
          )}

          <div className="absolute right-4 top-4 flex gap-2">
            <Rond etiquette={t("fiche.partager")} onClick={() => partager(photos[0].alt)}>
              <Partage />
            </Rond>
            <Rond
              etiquette={favori ? t("resultats.retirerFavori") : t("resultats.ajouterFavori")}
              presse={favori}
              onClick={() => basculer(logementId)}
            >
              <Coeur plein={favori} />
            </Rond>
          </div>

          {photos.length > 1 && (
            <>
              <Fleche cote="gauche" etiquette={t("fiche.photoPrecedente")} onClick={() => decaler(-1)} />
              <Fleche cote="droite" etiquette={t("fiche.photoSuivante")} onClick={() => decaler(1)} />
              <p
                aria-live="polite"
                className="absolute bottom-4 right-4 rounded-pill bg-primaire/85 px-3 py-1 text-petit font-semibold text-white chiffres-tabulaires"
              >
                {t("fiche.photoCompteur", { index: courante + 1, total: photos.length })}
              </p>
            </>
          )}

          <button
            type="button"
            onClick={() => setPleinEcran(courante)}
            aria-label={t("fiche.voirToutesPhotos")}
            className="absolute inset-0 cursor-zoom-in"
          />
        </div>

        {/* vignettes */}
        {/* La dernière vignette s'étale si le compte est impair : une case vide
            dans la mosaïque se lit comme une image qui n'a pas chargé. */}
        <div className="hidden grid-cols-2 grid-rows-2 gap-3 md:grid">
          {vignettes.map((photo, i) => {
            const dernier = i === vignettes.length - 1 && reste > 0;
            return (
              <button
                key={photo.url + i}
                type="button"
                onClick={() => setPleinEcran(i + 1)}
                className={
                  "relative h-full min-h-[110px] overflow-hidden rounded-card bg-champ " +
                  (vignettes.length % 2 === 1 && i === vignettes.length - 1 ? "col-span-2" : "")
                }
              >
                <Image
                  src={photo.url}
                  alt={dernier ? "" : photo.alt}
                  fill
                  sizes="20vw"
                  className="object-cover"
                />
                {dernier && (
                  <span className="absolute inset-0 flex items-center justify-center bg-primaire/60 text-titre-3 font-semibold text-white">
                    {t("fiche.plusPhotos", { nombre: reste })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* plein écran */}
      <dialog
        ref={dialogue}
        onClose={() => {
          // En sortant, la grande photo de la mosaïque reprend là où on en était.
          setCourante(vue);
          setPleinEcran(null);
        }}
        onKeyDown={(evenement) => {
          if (evenement.key === "ArrowRight") defiler(1);
          if (evenement.key === "ArrowLeft") defiler(-1);
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-primaire/95 p-0 backdrop:bg-primaire/80"
      >
        <button
          type="button"
          onClick={() => setPleinEcran(null)}
          aria-label={t("fiche.fermer")}
          className="absolute right-4 top-4 z-10 flex h-[var(--size-touch)] w-[var(--size-touch)] items-center justify-center rounded-pill bg-white/15 text-white"
        >
          <Icone nom="fermeture" taille={24} />
        </button>

        <ul
          ref={bande}
          onScroll={suivreDefilement}
          className="flex h-full snap-x snap-mandatory items-center overflow-x-auto"
        >
          {photos.map((photo, i) => (
            <li key={photo.url + i} className="relative h-[80%] w-full shrink-0 snap-start">
              <Image
                src={photo.url}
                alt={photo.alt}
                fill
                sizes="100vw"
                // Les voisines sont préparées, le reste attend d'être demandé :
                // une fiche de quarante photos ne se télécharge pas d'un bloc.
                priority={pleinEcran !== null && Math.abs(i - vue) <= 1}
                loading={pleinEcran !== null && Math.abs(i - vue) <= 1 ? "eager" : "lazy"}
                className="object-contain"
              />
            </li>
          ))}
        </ul>

        {photos.length > 1 && (
          <>
            <Fleche cote="gauche" etiquette={t("fiche.photoPrecedente")} onClick={() => defiler(-1)} />
            <Fleche cote="droite" etiquette={t("fiche.photoSuivante")} onClick={() => defiler(1)} />
            <p
              aria-live="polite"
              className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded-pill bg-nuit/70 px-4 py-1.5 text-petit font-semibold text-white chiffres-tabulaires"
            >
              {t("fiche.photoCompteur", { index: vue + 1, total: photos.length })}
            </p>
            <p className="absolute bottom-5 left-1/2 max-w-[70vw] -translate-x-1/2 text-center text-legende text-white/80">
              {photos[vue].alt}
            </p>
          </>
        )}
      </dialog>
    </>
  );
}

/** Partage natif quand le navigateur le propose ; copie du lien sinon. */
async function partager(titre: string) {
  const url = window.location.href;
  try {
    if (navigator.share) await navigator.share({ title: titre, url });
    else await navigator.clipboard.writeText(url);
  } catch {
    /* refus de l'utilisateur ou API absente : rien à signaler */
  }
}

function Rond({
  etiquette,
  presse,
  onClick,
  children,
}: {
  etiquette: string;
  presse?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiquette}
      aria-pressed={presse}
      className="relative z-10 flex h-11 w-11 items-center justify-center rounded-control bg-surface text-encre shadow-sm transition-colors hover:bg-champ"
    >
      {children}
    </button>
  );
}

function Fleche({
  cote,
  etiquette,
  onClick,
}: {
  cote: "gauche" | "droite";
  etiquette: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiquette}
      className={
        "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center " +
        "rounded-pill bg-surface/90 text-encre shadow-sm hover:bg-surface " +
        (cote === "gauche" ? "left-4" : "right-4")
      }
    >
      <Icone nom={cote === "gauche" ? "chevron-gauche" : "chevron-droite"} taille={24} />
    </button>
  );
}

function Coeur({ plein }: { plein: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={plein ? "#B42318" : "none"}
      stroke={plein ? "#B42318" : "currentColor"}
      strokeWidth="1.7"
    >
      <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z" />
    </svg>
  );
}

function Partage() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
    </svg>
  );
}
