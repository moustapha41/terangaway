"use client";

import { useLangue, useT } from "@/lib/i18n/contexte";
import { formaterConversion } from "@/lib/prix";
import { usePreferences } from "./use-preferences";

/**
 * Conversion indicative sous un prix — §C.4 : « La conversion en euros ou en
 * dollars s'affiche en texte secondaire, précédée de “environ” ».
 *
 * Les taux sont figés et le resteront jusqu'à ce qu'une source les fournisse.
 * Le montant qui engage reste en FCFA : c'est lui qu'on paiera sur place.
 */
const TAUX: Record<"EUR" | "USD", number> = { EUR: 1 / 656, USD: 1 / 610 };

export function PrixConverti({ montant, className }: { montant: number; className?: string }) {
  const { preferences } = usePreferences();
  const langue = useLangue();
  const t = useT();

  if (preferences.devise === "aucune") return null;

  return (
    <span className={className ?? "block text-legende text-encre-douce"}>
      {t("client.environ", {
        montant: formaterConversion(montant, TAUX[preferences.devise], preferences.devise, langue),
      })}
    </span>
  );
}
