"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Icone } from "../icones";
import { FeuilleBasse } from "./feuille-basse";

export interface Plage {
  debut?: string;
  fin?: string;
}

export interface EtiquettesDates {
  ouvrir: string;
  titre: string;
  fermer: string;
  moisPrecedent: string;
  moisSuivant: string;
  valider: string;
  effacer: string;
  /** Jours de la semaine, du lundi au dimanche, en une lettre ou deux. */
  jours: string[];
  /** Nom du mois affiché, par exemple « janvier 2026 ». */
  nomMois: (annee: number, mois: number) => string;
  /** Date complète, lue par les lecteurs d'écran. */
  dateComplete: (iso: string) => string;
  /** Ce qui s'affiche dans le champ quand rien n'est choisi. */
  vide: string;
  /** La plage choisie, mise en forme par l'application. */
  resume: (plage: Plage) => string;
}

/**
 * Sélecteur de dates — calendrier en feuille basse, dates indisponibles grisées
 * (§C.3). États : fermé, ouvert, plage choisie.
 *
 * Le composant ne met aucune date en forme : il reçoit ses libellés déjà
 * traduits. C'est la seule façon pour `@teranga/ui` de rester ignorant des
 * langues tout en affichant un calendrier correct dans les trois.
 *
 * La semaine commence le lundi, usage au Sénégal comme en Europe.
 */
export function SelecteurDates({
  libelle,
  plage,
  onChange,
  indisponibles = [],
  minimum,
  etiquettes,
  rendreChamp,
  className,
}: {
  libelle: string;
  plage: Plage;
  onChange: (plage: Plage) => void;
  /** Dates ISO (AAAA-MM-JJ) que le partenaire a bloquées. */
  indisponibles?: string[];
  /** Première date choisissable ; par défaut, aujourd'hui. */
  minimum?: string;
  etiquettes: EtiquettesDates;
  /**
   * Déclencheur sur mesure. Sans lui, le composant affiche son propre champ.
   * La barre de recherche de l'accueil s'en sert pour garder l'allure exacte de
   * la maquette tout en réutilisant ce calendrier — plutôt que d'en écrire un
   * second qui divergerait à la première correction.
   */
  rendreChamp?: (etat: { ouvrir: () => void; resume: string | null }) => ReactNode;
  className?: string;
}) {
  const [ouverte, setOuverte] = useState(false);
  const premier = minimum ?? isoDe(new Date());
  const [curseur, setCurseur] = useState(() => debutDeMois(plage.debut ?? premier));

  const bloquees = useMemo(() => new Set(indisponibles), [indisponibles]);

  const choisir = (iso: string) => {
    // Premier clic : début. Deuxième : fin, ou nouveau début si antérieur.
    if (!plage.debut || plage.fin) return onChange({ debut: iso });
    if (iso < plage.debut) return onChange({ debut: iso });
    onChange({ debut: plage.debut, fin: iso });
  };

  return (
    // `contents` avec un déclencheur sur mesure : le conteneur s'efface pour que
    // le ou les champs fournis deviennent des éléments de la grille parente.
    // Sans ça, deux boîtes « arrivée » et « départ » comptent pour une seule case.
    <div className={cn(rendreChamp ? "contents" : "flex flex-col gap-1", className)}>
      {rendreChamp ? (
        rendreChamp({
          ouvrir: () => setOuverte(true),
          resume: plage.debut ? etiquettes.resume(plage) : null,
        })
      ) : (
        <>
          <span className="text-petit text-encre">{libelle}</span>
          <button
            type="button"
            onClick={() => setOuverte(true)}
            aria-label={etiquettes.ouvrir}
            className={cn(
              "flex min-h-[var(--size-control)] items-center gap-2 rounded-control border border-contour-champ",
              "bg-surface px-3 text-left transition-colors duration-[var(--duree-fast)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire",
            )}
          >
            <Icone nom="calendrier" taille={20} className="shrink-0 text-encre-douce" />
            <span className={cn("flex-1 text-corps", plage.debut ? "text-encre chiffres-tabulaires" : "text-encre-douce")}>
              {plage.debut ? etiquettes.resume(plage) : etiquettes.vide}
            </span>
          </button>
        </>
      )}

      <FeuilleBasse
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre={etiquettes.titre}
        etiquetteFermer={etiquettes.fermer}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Navigation
              sens="precedent"
              etiquette={etiquettes.moisPrecedent}
              desactive={curseur <= debutDeMois(premier)}
              onClick={() => setCurseur(decalerMois(curseur, -1))}
            />
            <p className="text-titre-3 text-encre">
              {etiquettes.nomMois(curseur.getFullYear(), curseur.getMonth())}
            </p>
            <Navigation
              sens="suivant"
              etiquette={etiquettes.moisSuivant}
              desactive={false}
              onClick={() => setCurseur(decalerMois(curseur, 1))}
            />
          </div>

          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                {etiquettes.jours.map((jour, i) => (
                  <th key={i} scope="col" className="pb-2 text-legende font-normal text-encre-douce">
                    {jour}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semainesDe(curseur).map((semaine, i) => (
                <tr key={i}>
                  {semaine.map((iso, j) => (
                    <td key={j} className="p-0">
                      {iso && (
                        <Jour
                          iso={iso}
                          plage={plage}
                          desactive={iso < premier || bloquees.has(iso)}
                          etiquette={etiquettes.dateComplete(iso)}
                          onClick={() => choisir(iso)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({})}
              className="min-h-[var(--size-touch)] flex-1 rounded-control border border-contour-champ text-bouton text-encre"
            >
              {etiquettes.effacer}
            </button>
            <button
              type="button"
              onClick={() => setOuverte(false)}
              className="min-h-[var(--size-touch)] flex-1 rounded-control bg-primaire text-bouton text-white"
            >
              {etiquettes.valider}
            </button>
          </div>
        </div>
      </FeuilleBasse>
    </div>
  );
}

function Jour({
  iso,
  plage,
  desactive,
  etiquette,
  onClick,
}: {
  iso: string;
  plage: Plage;
  desactive: boolean;
  etiquette: string;
  onClick: () => void;
}) {
  const borne = iso === plage.debut || iso === plage.fin;
  const dedans = Boolean(plage.debut && plage.fin && iso > plage.debut && iso < plage.fin);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={etiquette}
      aria-pressed={borne || dedans}
      className={cn(
        "flex h-11 w-full items-center justify-center text-petit chiffres-tabulaires",
        "transition-colors duration-[var(--duree-fast)]",
        // Une date indisponible est grisée et barrée : la couleur seule ne suffit pas (§C.6).
        desactive && "cursor-not-allowed text-encre-douce line-through opacity-60",
        !desactive && !borne && !dedans && "text-encre hover:bg-champ",
        dedans && "bg-teinte-bleu text-primaire",
        borne && "rounded-control bg-primaire font-semibold text-white",
      )}
    >
      {Number(iso.slice(8, 10))}
    </button>
  );
}

function Navigation({
  sens,
  etiquette,
  desactive,
  onClick,
}: {
  sens: "precedent" | "suivant";
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
      className="flex h-[var(--size-touch)] w-[var(--size-touch)] items-center justify-center rounded-pill text-encre disabled:text-encre-douce disabled:opacity-40"
    >
      <Icone nom={sens === "precedent" ? "chevron-gauche" : "chevron-droite"} taille={24} />
    </button>
  );
}

/* ── Dates, en heure locale : un décalage UTC ferait sauter un jour ── */

function isoDe(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const j = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${j}`;
}

function debutDeMois(iso: string | Date): Date {
  const d = typeof iso === "string" ? new Date(`${iso}T00:00:00`) : iso;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function decalerMois(date: Date, pas: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + pas, 1);
}

/** Grille du mois, lundi en première colonne, cases vides aux extrémités. */
function semainesDe(curseur: Date): Array<Array<string | null>> {
  const annee = curseur.getFullYear();
  const mois = curseur.getMonth();
  const jours = new Date(annee, mois + 1, 0).getDate();
  const premierJour = (new Date(annee, mois, 1).getDay() + 6) % 7;

  const cases: Array<string | null> = Array.from({ length: premierJour }, () => null);
  for (let j = 1; j <= jours; j++) cases.push(isoDe(new Date(annee, mois, j)));
  while (cases.length % 7 !== 0) cases.push(null);

  return Array.from({ length: cases.length / 7 }, (_, i) => cases.slice(i * 7, i * 7 + 7));
}
