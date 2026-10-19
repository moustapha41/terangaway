"use client";

import Image from "next/image";
import { useState } from "react";
import type { Logement } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { formaterPrix, prixAffiche } from "@/lib/prix";
import { useFavoris } from "@/features/favoris/use-favoris";
import { situation } from "@/lib/lieu";

/**
 * Carte de résultat, format liste — maquette du parcours logement, écran 02.
 *
 * Photo à gauche avec défilement, contenu à droite : badge vérifié, titre,
 * quartier, note, capacités, équipements, prix par nuit **et** total du séjour.
 * Afficher les deux prix évite au visiteur de multiplier de tête, et c'est le
 * total qui décide (§C.4).
 */
export function CarteLogementListe({
  logement,
  nuits,
  parametres,
}: {
  logement: Logement;
  nuits: number;
  parametres?: string;
}) {
  const t = useT();
  const langue = useLangue();
  const { estFavori, basculer } = useFavoris();
  const [photo, setPhoto] = useState(0);

  const favori = estFavori(logement.id);
  const total = logement.prixParNuit * nuits;
  const lien = `/logements/${logement.slug}${parametres ? `?${parametres}` : ""}`;

  const decaler = (pas: number) =>
    setPhoto((i) => (i + pas + logement.photos.length) % logement.photos.length);

  return (
    <article className="relative overflow-hidden rounded-card border border-contour bg-surface transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
      <div className="flex flex-col sm:flex-row">
        {/* photo */}
        <div className="relative aspect-[4/3] w-full shrink-0 bg-champ sm:aspect-auto sm:h-[220px] sm:w-[260px]">
          <Image
            src={logement.photos[photo].url}
            alt={logement.photos[photo].alt}
            fill
            sizes="(max-width: 640px) 100vw, 260px"
            className="object-cover"
          />

          {logement.photos.length > 1 && (
            <>
              <Fleche cote="gauche" etiquette={t("resultats.photoPrecedente")} onClick={() => decaler(-1)} />
              <Fleche cote="droite" etiquette={t("resultats.photoSuivante")} onClick={() => decaler(1)} />
            </>
          )}
        </div>

        {/* contenu */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-succes px-2.5 py-1 text-legende font-semibold text-white">
                <Icone nom="verification" taille={16} />
                {t("commun.verifie")}
              </span>

              <h3 className="mt-2 text-titre-3 text-encre">
                <Lien href={lien} className="after:absolute after:inset-0 after:content-['']">
                  {logement.titre}
                </Lien>
              </h3>
              <p className="mt-0.5 text-petit text-encre-douce">
                {situation(logement)}
              </p>

              {logement.note !== undefined && (
                <p className="mt-1.5 flex items-center gap-1.5 text-petit text-encre">
                  <Etoile />
                  <span className="font-semibold chiffres-tabulaires">
                    {logement.note.toFixed(1).replace(".", langue === "en" ? "." : ",")}
                  </span>
                  <span className="text-encre-douce">
                    ({t("resultats.avis", { nombre: logement.nombreAvis ?? 0 })})
                  </span>
                </p>
              )}
            </div>

            {/* Le cœur passe au-dessus du lien qui couvre la carte. */}
            <button
              type="button"
              onClick={() => basculer(logement.id)}
              aria-pressed={favori}
              aria-label={favori ? t("resultats.retirerFavori") : t("resultats.ajouterFavori")}
              className="relative z-10 flex h-[var(--size-touch)] w-[var(--size-touch)] shrink-0 items-center justify-center rounded-pill text-encre-douce transition-colors hover:bg-champ"
            >
              <Coeur plein={favori} />
            </button>
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-petit text-encre-douce">
            <Trait icone="personnes">{t("resultats.voyageurs", { nombre: logement.capacite })}</Trait>
            <Trait icone="lit">{t("resultats.chambres", { nombre: logement.chambres })}</Trait>
            <Trait icone="salle-de-bain">
              {t("resultats.sallesDeBain", { nombre: logement.sallesDeBain })}
            </Trait>
          </ul>

          <ul className="mt-3 flex flex-wrap gap-2">
            {logement.equipements.slice(0, 4).map((equipement) => (
              <li
                key={equipement}
                className="rounded-control bg-champ px-2.5 py-1 text-legende text-encre-douce"
              >
                {t(`equipement.${equipement}`)}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-prix text-encre chiffres-tabulaires">
              {formaterPrix(prixAffiche(logement).montant, langue)}
              <span className="ml-1 text-petit font-normal text-encre-douce">
                {t(prixAffiche(logement).cleUnite)}
              </span>
            </p>
            <p className="text-petit text-encre-douce chiffres-tabulaires">
              {t("resultats.totalNuits", {
                prix: formaterPrix(total, langue),
                nuits: t("fiche.nuits", { nombre: nuits }),
              })}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function Trait({
  icone,
  children,
}: {
  icone: "personnes" | "lit" | "salle-de-bain";
  children: React.ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <Icone nom={icone} taille={16} />
      {children}
    </li>
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
        "absolute bottom-3 z-10 flex h-8 w-8 items-center justify-center rounded-pill " +
        "bg-surface/90 text-encre shadow-sm transition-colors hover:bg-surface " +
        (cote === "gauche" ? "left-3" : "right-3")
      }
    >
      <Icone nom={cote === "gauche" ? "chevron-gauche" : "chevron-droite"} taille={20} />
    </button>
  );
}

/** L'étoile et le cœur sont pleins : le jeu d'icônes du design system est au trait. */
function Etoile() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#F4B942">
      <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8Z" />
    </svg>
  );
}

function Coeur({ plein }: { plein: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={plein ? "#B42318" : "none"}
      stroke={plein ? "#B42318" : "currentColor"}
      strokeWidth="1.7"
    >
      <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z" />
    </svg>
  );
}
