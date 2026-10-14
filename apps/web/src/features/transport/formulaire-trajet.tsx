"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bouton, Champ, Compteur, SelecteurLieu, type Lieu } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";

/**
 * Écran 7 · Formulaire de trajet (§C.7).
 *
 * La saisie part dans l'URL : la liste de véhicules qui suit est partageable, et
 * un retour arrière ne perd rien (§B.1).
 *
 * Le cas bloquant des deux heures n'est **pas** vérifié ici : la règle appartient
 * au domaine, pas au formulaire. L'écran de résultats la fait appliquer par
 * l'API, de sorte qu'un lien forgé à la main ne la contourne pas.
 */
export function FormulaireTrajet({ lieux }: { lieux: Lieu[] }) {
  const t = useT();
  const naviguer = useNaviguer();
  const params = useSearchParams();

  const [depart, setDepart] = useState(params.get("depart") ?? "Aéroport AIBD");
  const [arrivee, setArrivee] = useState(params.get("arrivee") ?? "Plateau");
  const [quand, setQuand] = useState(params.get("quand") ?? "");
  const [passagers, setPassagers] = useState(Number(params.get("passagers") ?? 2));
  const [bagages, setBagages] = useState(Number(params.get("bagages") ?? 2));
  const [numeroVol, setNumeroVol] = useState(params.get("vol") ?? "");

  const concerneAeroport = `${depart} ${arrivee}`.toLowerCase().includes("aéroport");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams({
          depart,
          arrivee,
          quand,
          passagers: String(passagers),
          bagages: String(bagages),
        });
        if (numeroVol) params.set("vol", numeroVol);
        naviguer(`/transports/trajet?${params.toString()}`);
      }}
      className="space-y-5"
    >
      <SelecteurLieu
        libelle={t("transport.depart")}
        nom="depart"
        lieux={lieux}
        valeur={depart}
        onChange={setDepart}
        placeholder={t("transport.lieuPlaceholder")}
        requis
      />

      <SelecteurLieu
        libelle={t("transport.arrivee")}
        nom="arrivee"
        lieux={lieux}
        valeur={arrivee}
        onChange={setArrivee}
        placeholder={t("transport.lieuPlaceholder")}
        requis
      />

      <Champ
        libelle={t("transport.quand")}
        type="datetime-local"
        icone="calendrier"
        value={quand}
        onChange={(e) => setQuand(e.target.value)}
        required
      />

      <div className="space-y-3 rounded-control border border-contour bg-surface p-4">
        <Compteur libelle={t("transport.passagers")} valeur={passagers} min={1} max={14} onChange={setPassagers} />
        <Compteur libelle={t("transport.bagages")} valeur={bagages} min={0} max={14} onChange={setBagages} />
      </div>

      {/* Le numéro de vol n'apparaît que s'il sert : un champ inutile est un champ de trop. */}
      {concerneAeroport && (
        <Champ
          libelle={t("transport.numeroVol")}
          aide={t("transport.numeroVolAide")}
          icone="avion"
          placeholder="SN 1234"
          value={numeroVol}
          onChange={(e) => setNumeroVol(e.target.value)}
        />
      )}

      <Bouton type="submit" variante="principal" largeur="pleine">
        {t("transport.voirVehicules")}
      </Bouton>
    </form>
  );
}
