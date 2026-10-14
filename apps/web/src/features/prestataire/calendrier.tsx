"use client";

import { useState } from "react";
import { Bouton, Icone } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";

export interface Evenement {
  id: string;
  titre: string;
  sousTitre: string;
  debut: string;
  fin: string;
  statut: "attente" | "confirme" | "refuse" | "discussion";
}

/**
 * Calendrier mensuel des réservations — maquette du collage prestataire, écran 7.
 *
 * Les réservations sont posées en barres sur les jours qu'elles couvrent. Chaque
 * barre porte sa couleur de statut **et** son libellé : la couleur ne transporte
 * jamais seule l'information, et la palette est celle validée pour le daltonisme.
 *
 * La semaine commence le lundi, comme partout ailleurs dans le produit.
 */
const COULEURS: Record<Evenement["statut"], string> = {
  attente: "var(--color-graphe-attente)",
  confirme: "var(--color-graphe-confirme)",
  refuse: "var(--color-graphe-refuse)",
  discussion: "var(--color-graphe-discussion)",
};

export function Calendrier({ evenements }: { evenements: Evenement[] }) {
  const t = useT();
  const langue = useLangue();
  const [curseur, setCurseur] = useState(() => {
    const maintenant = new Date();
    return new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  });

  const nomMois = new Intl.DateTimeFormat(langue, { month: "long", year: "numeric" });
  const nomJour = new Intl.DateTimeFormat(langue, { weekday: "short" });
  const jours = Array.from({ length: 7 }, (_, i) => nomJour.format(new Date(2024, 0, 1 + i)));

  const annee = curseur.getFullYear();
  const mois = curseur.getMonth();
  const nombreJours = new Date(annee, mois + 1, 0).getDate();
  const premierJour = (new Date(annee, mois, 1).getDay() + 6) % 7;

  const cases: (number | null)[] = [
    ...Array.from({ length: premierJour }, () => null),
    ...Array.from({ length: nombreJours }, (_, i) => i + 1),
  ];
  while (cases.length % 7 !== 0) cases.push(null);

  const iso = (jour: number) =>
    `${annee}-${String(mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;

  const duJour = (jour: number) =>
    evenements.filter((e) => {
      const j = iso(jour);
      return j >= e.debut.slice(0, 10) && j <= e.fin.slice(0, 10);
    });

  const aujourdHui = new Date();
  const estAujourdHui = (jour: number) =>
    aujourdHui.getFullYear() === annee &&
    aujourdHui.getMonth() === mois &&
    aujourdHui.getDate() === jour;

  const decaler = (pas: number) => setCurseur(new Date(annee, mois + pas, 1));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bouton
            variante="secondaire"
            largeur="contenu"
            onClick={() => setCurseur(new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1))}
          >
            {t("prestataire.aujourdhui")}
          </Bouton>
          <button
            type="button"
            onClick={() => decaler(-1)}
            aria-label={t("recherche.moisPrecedent")}
            className="flex h-[var(--size-touch)] w-[var(--size-touch)] items-center justify-center rounded-control border border-contour-champ text-encre"
          >
            <Icone nom="chevron-gauche" taille={20} />
          </button>
          <button
            type="button"
            onClick={() => decaler(1)}
            aria-label={t("recherche.moisSuivant")}
            className="flex h-[var(--size-touch)] w-[var(--size-touch)] items-center justify-center rounded-control border border-contour-champ text-encre"
          >
            <Icone nom="chevron-droite" taille={20} />
          </button>
        </div>

        <p aria-live="polite" className="text-titre-3 capitalize text-encre">
          {nomMois.format(curseur)}
        </p>
      </div>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{t("prestataire.calendrierEtiquette")}</caption>
        <thead>
          <tr>
            {jours.map((jour) => (
              <th key={jour} scope="col" className="pb-2 text-legende font-normal text-encre-douce">
                {jour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cases.length / 7 }, (_, semaine) => (
            <tr key={semaine}>
              {cases.slice(semaine * 7, semaine * 7 + 7).map((jour, i) => (
                <td
                  key={i}
                  className="h-[94px] border border-contour p-1 align-top first:rounded-l-control last:rounded-r-control"
                >
                  {jour && (
                    <>
                      <span
                        className={
                          "inline-flex h-6 min-w-[24px] items-center justify-center rounded-pill px-1 text-legende chiffres-tabulaires " +
                          (estAujourdHui(jour)
                            ? "bg-primaire font-semibold text-white"
                            : "text-encre-douce")
                        }
                      >
                        {jour}
                      </span>

                      <ul className="mt-1 space-y-1">
                        {duJour(jour)
                          .slice(0, 2)
                          .map((evenement) => (
                            <li
                              key={evenement.id}
                              title={`${evenement.titre} · ${evenement.sousTitre}`}
                              style={{ backgroundColor: COULEURS[evenement.statut] }}
                              className="truncate rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold text-white"
                            >
                              {evenement.titre}
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Légende : la couleur seule ne dit rien. */}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {(["attente", "confirme", "refuse", "discussion"] as const).map((statut) => (
          <li key={statut} className="flex items-center gap-2 text-petit text-encre-douce">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: COULEURS[statut] }}
            />
            {t(`prestataire.statut${statut.charAt(0).toUpperCase()}${statut.slice(1)}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
