"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { EQUIPEMENTS, TYPES_LOGEMENT } from "@teranga/contracts";
import { Bouton, PuceFiltre } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";

/**
 * Puces de filtre et tri — écran 2 (§C.7).
 *
 * L'état vit dans l'URL, pas dans le composant : un résultat filtré se partage
 * et se recharge tel quel, et « rien n'est perdu » au retour arrière (§B.1).
 */
const TRIS = ["pertinence", "prix-croissant", "prix-decroissant", "capacite"] as const;

const CLE_TRI: Record<(typeof TRIS)[number], string> = {
  pertinence: "resultats.triPertinence",
  "prix-croissant": "resultats.triPrixCroissant",
  "prix-decroissant": "resultats.triPrixDecroissant",
  capacite: "resultats.triCapacite",
};

export function BarreFiltres() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, demarrer] = useTransition();

  const actifs = (nom: string) => params.get(nom)?.split(",").filter(Boolean) ?? [];

  const ecrire = (modifier: (p: URLSearchParams) => void) => {
    const suivants = new URLSearchParams(params.toString());
    modifier(suivants);
    demarrer(() => router.replace(`?${suivants.toString()}`, { scroll: false }));
  };

  const basculer = (nom: string, valeur: string) =>
    ecrire((p) => {
      const liste = new Set(actifs(nom));
      liste.has(valeur) ? liste.delete(valeur) : liste.add(valeur);
      liste.size ? p.set(nom, [...liste].join(",")) : p.delete(nom);
    });

  const aDesFiltres = actifs("types").length > 0 || actifs("equipements").length > 0;

  return (
    <div className="space-y-4" aria-busy={enCours || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        {TYPES_LOGEMENT.map((type) => (
          <PuceFiltre
            key={type}
            libelle={t(`typeLogement.${type}`)}
            active={actifs("types").includes(type)}
            onClick={() => basculer("types", type)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {EQUIPEMENTS.slice(0, 5).map((equipement) => (
          <PuceFiltre
            key={equipement}
            libelle={t(`equipement.${equipement}`)}
            active={actifs("equipements").includes(equipement)}
            onClick={() => basculer("equipements", equipement)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-petit text-encre">
          {t("resultats.trier")}
          <select
            value={params.get("tri") ?? "pertinence"}
            onChange={(e) =>
              ecrire((p) =>
                e.target.value === "pertinence" ? p.delete("tri") : p.set("tri", e.target.value),
              )
            }
            className="min-h-[var(--size-touch)] rounded-control border border-contour-champ bg-surface px-3 text-[16px] text-encre"
          >
            {TRIS.map((tri) => (
              <option key={tri} value={tri}>
                {t(CLE_TRI[tri])}
              </option>
            ))}
          </select>
        </label>

        {aDesFiltres && (
          <Bouton
            variante="secondaire"
            largeur="contenu"
            onClick={() => ecrire((p) => { p.delete("types"); p.delete("equipements"); })}
          >
            {t("resultats.effacerFiltres")}
          </Bouton>
        )}
      </div>
    </div>
  );
}
