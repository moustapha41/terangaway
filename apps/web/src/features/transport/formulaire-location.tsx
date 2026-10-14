"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bouton, Compteur, SelecteurDates, SelecteurLieu, type Lieu, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { useNaviguer } from "@/lib/i18n/naviguer";

/** Location avec chauffeur : ville, date de début, date de fin (§B.3). */
export function FormulaireLocation({ lieux }: { lieux: Lieu[] }) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();
  const params = useSearchParams();

  const [ville, setVille] = useState(params.get("ville") ?? "Dakar");
  const [plage, setPlage] = useState<Plage>({
    debut: params.get("debut") ?? undefined,
    fin: params.get("fin") ?? undefined,
  });
  const [passagers, setPassagers] = useState(Number(params.get("passagers") ?? 2));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams({ ville, passagers: String(passagers) });
        if (plage.debut) params.set("debut", plage.debut);
        if (plage.fin) params.set("fin", plage.fin);
        naviguer(`/transports/location?${params.toString()}`);
      }}
      className="space-y-5"
    >
      <SelecteurLieu
        libelle={t("transport.ville")}
        nom="ville"
        lieux={lieux}
        valeur={ville}
        onChange={setVille}
        requis
      />

      <SelecteurDates
        libelle={`${t("transport.debut")} — ${t("transport.fin")}`}
        plage={plage}
        onChange={setPlage}
        etiquettes={etiquettesDates(t, langue)}
      />

      <div className="rounded-control border border-contour bg-surface p-4">
        <Compteur libelle={t("transport.passagers")} valeur={passagers} min={1} max={14} onChange={setPassagers} />
      </div>

      <Bouton type="submit" variante="principal" largeur="pleine" disabled={!plage.debut || !plage.fin}>
        {t("transport.voirDisponibles")}
      </Bouton>
    </form>
  );
}
