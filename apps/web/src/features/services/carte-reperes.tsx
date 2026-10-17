"use client";

import { useState } from "react";
import { Icone } from "@teranga/ui";
import type { LieuSitue } from "@/features/transport/zones";
import { CarteTuiles } from "@/lib/carte/carte-tuiles";
import { useT } from "@/lib/i18n/contexte";

/**
 * La carte des points de repère — sites des Jeux, aéroport, quartiers.
 *
 * La liste et la carte montrent la même chose : cliquer un nom allume le
 * repère, et l'inverse. Une carte seule obligerait à survoler chaque épingle
 * pour lire un nom, et une liste seule ne dirait pas ce qui est loin de quoi.
 *
 * Aucune adresse de partenaire ici : ces points sont publics, les logements
 * et les chauffeurs n'y figurent pas (§D.4).
 */
export function CarteReperes({ lieux }: { lieux: LieuSitue[] }) {
  const t = useT();
  const [choisi, setChoisi] = useState<string | null>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <ul className="order-2 space-y-2 lg:order-1">
        {lieux.map((lieu) => {
          const actif = choisi === lieu.valeur;
          return (
            <li key={lieu.valeur}>
              <button
                type="button"
                onClick={() => setChoisi(actif ? null : lieu.valeur)}
                aria-pressed={actif}
                className={
                  "flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors " +
                  (actif
                    ? "border-primaire bg-teinte-bleu"
                    : "border-contour bg-surface hover:border-primaire/40")
                }
              >
                <span
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-pill " +
                    (actif ? "bg-primaire text-white" : "bg-teinte-bleu text-primaire")
                  }
                >
                  <Icone nom="repere" taille={20} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-petit font-semibold text-encre">
                    {lieu.valeur}
                  </span>
                  <span className="block truncate text-legende text-encre-douce">
                    {lieu.detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="order-1 lg:order-2">
        <CarteTuiles
          etiquette={t("repere.carte")}
          className="h-[420px] w-full lg:h-[560px]"
          reperes={lieux.map((lieu) => ({
            id: lieu.valeur,
            latitude: lieu.latitude,
            longitude: lieu.longitude,
            libelle: lieu.valeur,
            actif: choisi === lieu.valeur,
            onClick: () => setChoisi(lieu.valeur),
          }))}
        />
        <p className="mt-2 text-legende text-encre-douce">{t("repere.note")}</p>
      </div>
    </div>
  );
}
