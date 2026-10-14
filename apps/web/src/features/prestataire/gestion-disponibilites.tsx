"use client";

import { useState } from "react";
import { Bandeau, Bouton, Icone, SelecteurDates, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { sauverDisponibilites } from "./actions";
import { formaterPlage } from "@/lib/dates";
import type { Periode } from "@/mocks/fixtures/prestataire";

/**
 * Périodes de disponibilité.
 *
 * Elles partent dans un champ caché, sérialisées : le formulaire reste un vrai
 * `<form>` posté au serveur, ce qui garde un chemin de secours si le JavaScript
 * tombe en cours de route.
 */
export function GestionDisponibilites({
  id,
  initiales,
}: {
  id: string;
  initiales: Periode[];
}) {
  const t = useT();
  const langue = useLangue();
  const [periodes, setPeriodes] = useState<Periode[]>(initiales);
  const [plage, setPlage] = useState<Plage>({});

  const ajouter = () => {
    if (!plage.debut || !plage.fin) return;
    setPeriodes((liste) => [...liste, { debut: plage.debut!, fin: plage.fin! }]);
    setPlage({});
  };

  return (
    <form action={sauverDisponibilites} className="space-y-6">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="periodes"
        value={periodes.map((p) => `${p.debut}~${p.fin}`).join("|")}
      />

      {periodes.length === 0 ? (
        <Bandeau variante="avertissement">{t("prestataire.dispoAucune")}</Bandeau>
      ) : (
        <ul className="space-y-2">
          {periodes.map((periode, i) => (
            <li
              key={`${periode.debut}-${periode.fin}`}
              className="flex items-center justify-between gap-4 rounded-control border border-contour bg-surface px-4 py-3"
            >
              <span className="text-corps text-encre chiffres-tabulaires">
                {formaterPlage(
                  new Date(`${periode.debut}T00:00:00`),
                  new Date(`${periode.fin}T00:00:00`),
                  langue,
                )}
              </span>
              <button
                type="button"
                onClick={() => setPeriodes((liste) => liste.filter((_, j) => j !== i))}
                aria-label={t("prestataire.dispoSupprimer")}
                className="flex h-[var(--size-touch)] w-[var(--size-touch)] shrink-0 items-center justify-center rounded-pill text-danger hover:bg-teinte-rouge"
              >
                <Icone nom="fermeture" taille={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-card border border-contour bg-surface p-4">
        <SelecteurDates
          libelle={t("recherche.dates")}
          plage={plage}
          onChange={setPlage}
          etiquettes={etiquettesDates(t, langue)}
        />
        <Bouton
          variante="secondaire"
          largeur="pleine"
          icone="plus"
          disabled={!plage.debut || !plage.fin}
          onClick={ajouter}
        >
          {t("prestataire.dispoAjouter")}
        </Bouton>
      </div>

      <Bouton type="submit" variante="principal" largeur="pleine">
        {t("prestataire.dispoEnregistrer")}
      </Bouton>
    </form>
  );
}
