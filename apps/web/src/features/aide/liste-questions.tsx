"use client";

import { useState } from "react";
import { Bouton, Carte, Icone } from "@teranga/ui";
import { QUESTIONS } from "./questions";
import { Lien } from "@/lib/i18n/lien";
import { useT } from "@/lib/i18n/contexte";

/**
 * Questions fréquentes, filtrées par la recherche.
 *
 * Chaque question est un `<details>` natif : elle s'ouvre sans JavaScript, et
 * le navigateur la trouve avec sa propre recherche de page. « Tout développer »
 * est le seul morceau qui demande du script, donc le seul qui disparaît s'il
 * n'y en a pas — le contenu, lui, reste lisible.
 *
 * Le filtrage cherche dans la question **et** dans la réponse : quelqu'un qui
 * tape « bancaire » ne trouve ce mot que dans le corps de la réponse sécurité.
 */
export function ListeQuestions({ requete }: { requete: string }) {
  const t = useT();
  const [toutOuvert, setToutOuvert] = useState<boolean | null>(null);

  const normaliser = (texte: string) =>
    texte
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const terme = normaliser(requete.trim());
  const retenues = terme
    ? QUESTIONS.filter(
        (cle) =>
          normaliser(t(`aide.q.${cle}`)).includes(terme) ||
          normaliser(t(`aide.q.${cle}R`)).includes(terme),
      )
    : [...QUESTIONS];

  if (retenues.length === 0) {
    return (
      <Carte className="p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-champ text-encre-douce">
          <Icone nom="recherche" taille={24} />
        </span>
        <p className="mt-3 text-titre-3 text-encre">
          {t("aide.aucunResultat", { requete: requete.trim() })}
        </p>
        <p className="mt-2 text-petit text-encre-douce">{t("aide.aucunResultatTexte")}</p>
        <div className="mx-auto mt-5 max-w-[280px]">
          <Lien href="/aide">
            <Bouton variante="secondaire" largeur="pleine">
              {t("aide.effacerRecherche")}
            </Bouton>
          </Lien>
        </div>
      </Carte>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-petit text-encre-douce">
          {terme
            ? t(
                retenues.length > 1 ? "aide.resultatsPluriel" : "aide.resultats",
                { nombre: retenues.length, total: QUESTIONS.length },
              )
            : t("aide.faqSousTitre")}
        </p>

        <button
          type="button"
          onClick={() => setToutOuvert((avant) => !avant)}
          className="inline-flex min-h-[var(--size-touch)] items-center gap-1.5 text-petit font-semibold text-primaire underline underline-offset-2"
        >
          {t(toutOuvert ? "aide.toutReduire" : "aide.toutDevelopper")}
          <Icone nom={toutOuvert ? "moins" : "plus"} taille={16} />
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {retenues.map((cle) => (
          <li key={cle}>
            <Carte className="overflow-hidden">
              <details
                // `key` sur le details force le remontage quand « tout
                // développer » bascule : sinon React garde l'état `open` que
                // l'utilisateur a posé à la main sur une question.
                key={`${cle}-${toutOuvert}`}
                open={toutOuvert ?? false}
                className="group"
              >
                <summary className="flex min-h-[var(--size-touch)] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-petit font-semibold text-encre marker:content-none">
                  {t(`aide.q.${cle}`)}
                  <Icone
                    nom="chevron"
                    taille={20}
                    className="shrink-0 text-encre-douce transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="border-t border-contour px-5 py-4 text-corps leading-relaxed text-encre-douce">
                  {t(`aide.q.${cle}R`)}
                </p>
              </details>
            </Carte>
          </li>
        ))}
      </ul>
    </div>
  );
}
