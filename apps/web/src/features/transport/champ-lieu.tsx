"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, LoaderCircle, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/contexte";
import { lieuLePlusProche, suggerer, type LieuSitue } from "./zones";

type EtatLocalisation =
  | { genre: "repos" }
  | { genre: "encours" }
  | { genre: "trouve"; lieu: LieuSitue; distanceKm: number; certain: boolean }
  | { genre: "refuse" }
  | { genre: "indisponible" };

/**
 * Un lieu de prise en charge ou d'arrivée.
 *
 * Deux façons d'y répondre, parce qu'un visiteur étranger n'a souvent ni l'une
 * ni l'autre tout seul :
 *
 * 1. **Il tape**, et la liste se réduit à mesure. La comparaison ignore les
 *    accents — « aeroport » trouve « Aéroport AIBD » — et porte aussi sur le
 *    détail, pour que « Diamniadio » ramène les trois sites qui s'y trouvent.
 * 2. **Il se laisse localiser.** Quelqu'un qui descend d'avion sait qu'il vient
 *    d'atterrir, pas qu'il est « à Diass ». Le bouton lui évite de le deviner.
 *
 * La position ne sert qu'ici : elle est rapprochée du lieu desservi le plus
 * proche, dans le navigateur, et seul le **nom** part ensuite. Aucune
 * coordonnée n'atteint le serveur.
 *
 * Le champ reste libre : la liste propose, elle n'impose pas. Un lieu qu'on ne
 * dessert pas encore doit pouvoir être demandé — c'est ainsi qu'on apprend
 * lesquels ajouter.
 */
export function ChampLieu({
  valeur,
  onChange,
  libelle,
  placeholder,
  localiser = false,
  lieux,
  name,
}: {
  /** Les lieux desservis, situés. Fournis par le parent, qui lit le catalogue. */
  lieux: LieuSitue[];
  valeur: string;
  onChange: (v: string) => void;
  libelle: string;
  placeholder?: string;
  /** Le bouton « Me localiser », réservé au lieu de prise en charge. */
  localiser?: boolean;
  name?: string;
}) {
  const t = useT();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<EtatLocalisation>({ genre: "repos" });
  const boite = useRef<HTMLDivElement>(null);

  const propositions = suggerer(valeur, lieux);

  // Un clic en dehors referme la liste. Sans ça, elle reste ouverte sous les
  // champs suivants et masque le bouton de recherche.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  function meLocaliser() {
    if (!("geolocation" in navigator)) {
      setEtat({ genre: "indisponible" });
      return;
    }
    setEtat({ genre: "encours" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const trouve = lieuLePlusProche(
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
          lieux,
        );
        if (!trouve) {
          setEtat({ genre: "indisponible" });
          return;
        }
        onChange(trouve.lieu.valeur);
        setOuvert(false);
        setEtat({
          genre: "trouve",
          lieu: trouve.lieu,
          distanceKm: trouve.distanceKm,
          certain: trouve.certain,
        });
      },
      // Refus, position indisponible, délai dépassé : un seul message, parce
      // que la personne n'y peut rien de différent — elle tape son lieu.
      () => setEtat({ genre: "refuse" }),
      // `maximumAge: 0` : on presse ce bouton exprès, souvent parce qu'on vient
      // de se déplacer. Une position d'il y a une minute répondrait à la
      // question d'avant.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  return (
    <div ref={boite} className="relative">
      <div className="flex h-[70px] items-center gap-4 rounded-xl border border-bordure px-5 transition-colors focus-within:border-nuit/40">
        <MapPin strokeWidth={1.6} className="h-6 w-6 shrink-0 text-nuit" />
        <span className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-[13px] text-gris">
            {libelle}
          </label>
          <input
            id={id}
            name={name}
            value={valeur}
            onChange={(e) => {
              onChange(e.target.value);
              setOuvert(true);
              setEtat({ genre: "repos" });
            }}
            onFocus={() => setOuvert(true)}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={ouvert}
            aria-controls={`${id}-liste`}
            className="block w-full truncate bg-transparent text-[17px] font-semibold text-nuit outline-none placeholder:font-normal placeholder:text-gris"
          />
        </span>

        {localiser && (
          <button
            type="button"
            onClick={meLocaliser}
            disabled={etat.genre === "encours"}
            aria-label={t("transport.meLocaliser")}
            title={t("transport.meLocaliser")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-nuit transition-colors hover:bg-fond disabled:opacity-50"
          >
            {etat.genre === "encours" ? (
              <LoaderCircle strokeWidth={1.8} className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            ) : (
              <Crosshair strokeWidth={1.8} className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {ouvert && propositions.length > 0 && (
        <ul
          id={`${id}-liste`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-bordure bg-white py-1 shadow-[0_12px_32px_-12px_rgb(2_20_38/0.25)]"
        >
          {propositions.map((lieu) => (
            <li key={lieu.valeur}>
              <button
                type="button"
                role="option"
                aria-selected={lieu.valeur === valeur}
                onClick={() => {
                  onChange(lieu.valeur);
                  setOuvert(false);
                  setEtat({ genre: "repos" });
                }}
                className="flex w-full items-baseline gap-2 px-4 py-2.5 text-left transition-colors hover:bg-fond"
              >
                <span className="text-[15px] font-semibold text-nuit">{lieu.valeur}</span>
                <span className="truncate text-[13px] text-gris">{lieu.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ce que la localisation a donné, dit sans affirmer plus que de raison. */}
      {etat.genre === "trouve" && (
        <p className="mt-1.5 px-1 text-[12.5px] text-gris">
          {etat.certain
            ? t("transport.localiseA", {
                lieu: etat.lieu.valeur,
                distance: formaterDistance(etat.distanceKm),
              })
            : t("transport.localisePres", {
                lieu: etat.lieu.valeur,
                distance: formaterDistance(etat.distanceKm),
              })}
        </p>
      )}
      {etat.genre === "refuse" && (
        <p className="mt-1.5 px-1 text-[12.5px] text-gris">{t("transport.localisationRefusee")}</p>
      )}
      {etat.genre === "indisponible" && (
        <p className="mt-1.5 px-1 text-[12.5px] text-gris">
          {t("transport.localisationIndisponible")}
        </p>
      )}
    </div>
  );
}

/** Sous le kilomètre, le mètre ; au-delà, le kilomètre sans décimale inutile. */
function formaterDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
