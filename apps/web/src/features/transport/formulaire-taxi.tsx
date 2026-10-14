"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bouton, Champ, Compteur, SelecteurLieu, type Lieu } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";

/**
 * Taxi réservé : lieu et heure de prise en charge, destination, passagers (§B.3).
 * Aucune liste de véhicules ne suit — seulement un prix indicatif.
 */
export function FormulaireTaxi({ lieux }: { lieux: Lieu[] }) {
  const t = useT();
  const naviguer = useNaviguer();
  const params = useSearchParams();

  const [lieu, setLieu] = useState(params.get("lieu") ?? "Plateau");
  const [destination, setDestination] = useState(params.get("destination") ?? "Stade Abdoulaye-Wade");
  const [quand, setQuand] = useState(params.get("quand") ?? "");
  const [passagers, setPassagers] = useState(Number(params.get("passagers") ?? 2));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        naviguer(
          `/transports/taxi?${new URLSearchParams({ lieu, destination, quand, passagers: String(passagers) })}`,
        );
      }}
      className="space-y-5"
    >
      <SelecteurLieu
        libelle={t("transport.lieuPriseEnCharge")}
        nom="lieu"
        lieux={lieux}
        valeur={lieu}
        onChange={setLieu}
        requis
      />
      <SelecteurLieu
        libelle={t("transport.destination")}
        nom="destination"
        lieux={lieux}
        valeur={destination}
        onChange={setDestination}
        requis
      />
      <Champ
        libelle={t("transport.quand")}
        type="datetime-local"
        icone="horloge"
        value={quand}
        onChange={(e) => setQuand(e.target.value)}
        required
      />
      <div className="rounded-control border border-contour bg-surface p-4">
        <Compteur libelle={t("transport.passagers")} valeur={passagers} min={1} max={7} onChange={setPassagers} />
      </div>

      <Bouton type="submit" variante="principal" largeur="pleine">
        {t("transport.demanderTaxi")}
      </Bouton>
    </form>
  );
}
