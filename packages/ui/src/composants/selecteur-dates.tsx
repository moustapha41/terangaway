"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Icone } from "../icones";
import { FeuilleBasse } from "./feuille-basse";

export interface Plage {
  debut?: string;
  fin?: string;
}

/** Quelle des deux bornes le calendrier est en train de demander. */
export type BorneDate = "debut" | "fin";

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
  /* ── Ce qui guide le prochain clic ── */
  /** « Choisissez d'abord la date de début ». */
  etapeDebut: string;
  /** « Maintenant la date de fin ». */
  etapeFin: string;
  /** Ce qu'on affiche quand les deux bornes sont posées : un constat, pas un ordre. */
  etapeComplete: string;
  /** Intitulés des deux bornes, au-dessus du calendrier. */
  debut: string;
  fin: string;
  /** Le nombre de nuits, une fois la plage complète. */
  nuits: (nombre: number) => string;
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
  rendreChamp?: (etat: {
    /** Sans argument : le calendrier choisit la borne. Avec : il s'ouvre dessus. */
    ouvrir: (borne?: BorneDate) => void;
    resume: string | null;
  }) => ReactNode;
  className?: string;
}) {
  const [ouverte, setOuverte] = useState(false);
  /**
   * La borne que le prochain clic renseigne.
   *
   * Chaque case ouvre le calendrier pour **sa** date : on clique « Début », on
   * choisit un jour, on valide. La plage en deux clics d'affilée demandait de
   * deviner que le même calendrier servait aux deux bornes — c'est précisément
   * ce qui n'était pas compris.
   */
  const [cible, setCible] = useState<BorneDate>("debut");
  /** Ouvert depuis une case précise, ou depuis un déclencheur unique ? */
  const [cibleImposee, setCibleImposee] = useState(false);
  const premier = minimum ?? isoDe(new Date());
  const [curseur, setCurseur] = useState(() => debutDeMois(plage.debut ?? premier));

  const bloquees = useMemo(() => new Set(indisponibles), [indisponibles]);

  /** Le nombre de nuits, une fois les deux bornes posées. C'est l'unité dans
   *  laquelle on raisonne un séjour — et celle dans laquelle il se facture. */
  const nombreDeNuits =
    plage.debut && plage.fin
      ? Math.round(
          (Date.parse(`${plage.fin}T00:00:00Z`) - Date.parse(`${plage.debut}T00:00:00Z`)) /
            86_400_000,
        )
      : null;

  /**
   * Ouvre le calendrier, éventuellement sur une borne précise.
   *
   * L'argument est validé plutôt que cru : plusieurs appelants écrivent
   * `onClick={ouvrir}`, ce qui transmettrait l'événement de souris à la place
   * de la borne.
   */
  const ouvrir = (borne?: BorneDate | unknown) => {
    const demandee: BorneDate | undefined =
      borne === "debut" || borne === "fin" ? borne : undefined;
    setCible(demandee ?? (plage.debut && !plage.fin ? "fin" : "debut"));
    setCibleImposee(Boolean(demandee));
    setOuverte(true);
  };

  /**
   * Le premier jour choisissable pour la borne visée.
   *
   * Une fin ne peut pas précéder le début, ni tomber le même jour : une nuit
   * au moins sépare une arrivée d'un départ.
   */
  const plancher =
    cible === "fin" && plage.debut ? lendemain(plage.debut) : premier;

  const choisir = (iso: string) => {
    if (cible === "fin") {
      return onChange({ debut: plage.debut, fin: iso });
    }
    // Un début postérieur à la fin viderait la plage de son sens : la fin
    // repart à zéro plutôt que de produire une période à l'envers.
    const fin = plage.fin && iso < plage.fin ? plage.fin : undefined;
    onChange({ debut: iso, fin });
    // Déclencheur unique : on enchaîne sur la fin, sans refermer. Case dédiée :
    // on s'arrête, c'est cette date-là qu'on venait poser.
    if (!cibleImposee) setCible("fin");
  };

  return (
    // `contents` avec un déclencheur sur mesure : le conteneur s'efface pour que
    // le ou les champs fournis deviennent des éléments de la grille parente.
    // Sans ça, deux boîtes « arrivée » et « départ » comptent pour une seule case.
    <div className={cn(rendreChamp ? "contents" : "flex flex-col gap-1", className)}>
      {rendreChamp ? (
        rendreChamp({
          ouvrir,
          resume: plage.debut ? etiquettes.resume(plage) : null,
        })
      ) : (
        <>
          <span className="text-petit text-encre">{libelle}</span>
          <button
            type="button"
            onClick={() => ouvrir()}
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
        // Deux mois de front demandent plus que les 560 px des autres feuilles.
        className="sm:max-w-[680px]"
      >
        <div className="space-y-4">
          {/*
            Le calendrier ne disait pas ce qu'il attendait. Deux clics sont
            nécessaires, et rien ne l'annonçait : on choisissait une date, la
            feuille restait ouverte, et il fallait deviner que le clic suivant
            servirait à la fin du séjour. Cette bande le dit, et montre l'état.
          */}
          <div className="rounded-card bg-champ px-4 py-3">
            <p className="text-petit font-semibold text-encre">
              {/* Ouvert depuis une case, la phrase nomme la borne qu'on vient
                  poser — c'est la seule question du moment. Ouvert depuis un
                  déclencheur unique, elle suit l'enchaînement, et constate une
                  fois la plage complète plutôt que de donner un ordre. */}
              {!cibleImposee && plage.debut && plage.fin
                ? etiquettes.etapeComplete
                : cible === "fin"
                  ? etiquettes.etapeFin
                  : etiquettes.etapeDebut}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Borne
                libelle={etiquettes.debut}
                valeur={plage.debut ? etiquettes.dateComplete(plage.debut) : null}
                vide={etiquettes.vide}
                actif={cible === "debut"}
              />
              <Icone nom="chevron-droite" taille={16} className="shrink-0 text-encre-douce" />
              <Borne
                libelle={etiquettes.fin}
                valeur={plage.fin ? etiquettes.dateComplete(plage.fin) : null}
                vide={etiquettes.vide}
                actif={cible === "fin"}
              />
              {nombreDeNuits !== null && (
                <span className="ml-auto shrink-0 rounded-pill bg-primaire px-3 py-1 text-legende font-semibold text-white">
                  {etiquettes.nuits(nombreDeNuits)}
                </span>
              )}
            </div>
          </div>

          {/*
            Deux mois de front dès qu'il y a la place.
            Un séjour traverse souvent la fin du mois — du 25 octobre au
            1er novembre, par exemple. Avec un seul mois à l'écran, il fallait
            cliquer « mois suivant » pour poser la date de fin, et le début
            sortait du champ de vision au moment même où on le comparait.
            Sur téléphone, le second mois est masqué : la largeur n'y est pas,
            et la navigation d'un mois à l'autre reprend son rôle.
          */}
          <div className="flex items-center justify-between">
            <Navigation
              sens="precedent"
              etiquette={etiquettes.moisPrecedent}
              desactive={curseur <= debutDeMois(premier)}
              onClick={() => setCurseur(decalerMois(curseur, -1))}
            />
            <p className="text-titre-3 text-encre">
              <span>{etiquettes.nomMois(curseur.getFullYear(), curseur.getMonth())}</span>
              <span className="hidden sm:inline">
                {" — "}
                {etiquettes.nomMois(
                  decalerMois(curseur, 1).getFullYear(),
                  decalerMois(curseur, 1).getMonth(),
                )}
              </span>
            </p>
            <Navigation
              sens="suivant"
              etiquette={etiquettes.moisSuivant}
              desactive={false}
              onClick={() => setCurseur(decalerMois(curseur, 1))}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Mois
              debut={curseur}
              plage={plage}
              bloquees={bloquees}
              etiquettes={etiquettes}
              onChoisir={choisir}
              plancher={plancher}
            />
            <div className="hidden sm:block">
              <Mois
                debut={decalerMois(curseur, 1)}
                plage={plage}
                  bloquees={bloquees}
                etiquettes={etiquettes}
                onChoisir={choisir}
                plancher={plancher}
              />
            </div>
          </div>

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
              // Ouvert sur une case précise, il suffit que cette date-là soit
              // posée. Ouvert depuis un déclencheur unique, la plage entière est
              // attendue : une moitié de réponse ne sert à rien à la recherche.
              disabled={cibleImposee ? !plage[cible] : !plage.debut || !plage.fin}
              className="min-h-[var(--size-touch)] flex-1 rounded-control bg-primaire text-bouton text-white disabled:opacity-45"
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

/** Une borne de la plage : son intitulé, sa valeur, et si c'est son tour. */
function Borne({
  libelle,
  valeur,
  vide,
  actif,
}: {
  libelle: string;
  valeur: string | null;
  vide: string;
  actif: boolean;
}) {
  return (
    <span
      className={cn(
        "min-w-0 rounded-control border px-3 py-1.5",
        actif ? "border-primaire bg-surface" : "border-contour bg-surface",
      )}
    >
      <span className="block text-legende text-encre-douce">{libelle}</span>
      <span
        className={cn(
          "block truncate text-petit font-semibold",
          valeur ? "text-encre chiffres-tabulaires" : "text-encre-douce",
        )}
      >
        {valeur ?? vide}
      </span>
    </span>
  );
}

/** La grille d'un mois : en-têtes de colonnes et jours cliquables. */
function Mois({
  debut,
  plage,
  plancher,
  bloquees,
  etiquettes,
  onChoisir,
}: {
  debut: Date;
  plage: Plage;
  /** Premier jour choisissable, qui dépend de la borne visée. */
  plancher: string;
  bloquees: Set<string>;
  etiquettes: EtiquettesDates;
  onChoisir: (iso: string) => void;
}) {
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">
        {etiquettes.nomMois(debut.getFullYear(), debut.getMonth())}
      </caption>
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
        {semainesDe(debut).map((semaine, i) => (
          <tr key={i}>
            {semaine.map((iso, j) => (
              <td key={j} className="p-0">
                {iso && (
                  <Jour
                    iso={iso}
                    plage={plage}
                    desactive={iso < plancher || bloquees.has(iso)}
                    etiquette={etiquettes.dateComplete(iso)}
                    onClick={() => onChoisir(iso)}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Le jour suivant, en ISO. Une fin ne peut pas tomber le jour du début. */
function lendemain(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
