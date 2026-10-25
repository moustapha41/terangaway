"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";

/**
 * Tri et bascule liste / carte — maquette écran 02 des logements, écran 2 des
 * transports : la même barre sert les deux, seuls les tris changent.
 */
const CLE_TRI: Record<string, string> = {
  pertinence: "resultats.triPertinence",
  "prix-croissant": "resultats.triPrixCroissant",
  "prix-decroissant": "resultats.triPrixDecroissant",
  capacite: "resultats.triCapacite",
  note: "resultats.triNote",
  places: "resultats.triPlaces",
};

// Le premier de la liste est celui qui s'applique sans consigne.
const TRIS_LOGEMENT = ["prix-croissant", "prix-decroissant", "pertinence", "capacite", "note"];

export function BarreOutils({
  vue,
  tris = TRIS_LOGEMENT,
  triParDefaut = TRIS_LOGEMENT[0],
  avecCarte = true,
}: {
  vue: "liste" | "carte";
  /** Les tris proposés ; par défaut ceux des logements. */
  tris?: string[];
  /**
   * Celui qui s'applique quand l'adresse n'en nomme aucun.
   *
   * Les logements se classent du moins cher au plus cher ; les transports
   * gardent leur pertinence. Les deux listes n'ayant pas les mêmes tris, le
   * défaut se dit ici plutôt que de se deviner.
   */
  triParDefaut?: string;
  /** La vue carte n'a pas de sens partout : on peut ne proposer que la liste. */
  avecCarte?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [, demarrer] = useTransition();

  const poser = (nom: string, valeur: string | null) => {
    const suivants = new URLSearchParams(params.toString());
    if (valeur) suivants.set(nom, valeur);
    else suivants.delete(nom);
    demarrer(() => router.replace(`?${suivants.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-petit text-encre-douce">
        {t("resultats.trier")}
        <select
          value={params.get("tri") ?? triParDefaut}
          // Toujours écrit dans l'adresse, même quand c'est le tri par défaut :
          // l'effacer rendrait la page sans critère, et `/logements` montrerait
          // alors sa vitrine au lieu des résultats qu'on vient de trier.
          onChange={(e) => poser("tri", e.target.value)}
          className="min-h-[var(--size-touch)] rounded-control border border-contour-champ bg-surface px-3 text-[16px] text-encre"
        >
          {tris.map((tri) => (
            <option key={tri} value={tri}>
              {t(CLE_TRI[tri])}
            </option>
          ))}
        </select>
      </label>

      {/* Bascule : deux boutons, un seul enfoncé — pas un interrupteur, car les
          deux vues sont des destinations, pas un état activé/désactivé. */}
      {avecCarte && (
      <div role="group" aria-label={t("resultats.vueListe")} className="flex overflow-hidden rounded-control border border-contour-champ">
        {(["liste", "carte"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vue === v}
            onClick={() => poser("vue", v === "liste" ? null : v)}
            className={
              "inline-flex min-h-[var(--size-control)] items-center gap-2 px-4 text-petit font-semibold transition-colors " +
              (vue === v ? "bg-primaire text-white" : "bg-surface text-encre hover:bg-champ")
            }
          >
            <Icone nom={v === "liste" ? "tri" : "repere"} taille={20} />
            {t(v === "liste" ? "resultats.vueListe" : "resultats.vueCarte")}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
