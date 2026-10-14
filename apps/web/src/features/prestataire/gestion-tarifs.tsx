"use client";

import { useState } from "react";
import { Bouton, Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { sauverTarifs } from "./actions";

interface Frais {
  libelle: string;
  montant: number;
}

/** Prix par nuit, séjour minimum et frais fixes — ce que le visiteur verra. */
export function GestionTarifs({
  id,
  prixParNuit,
  sejourMinimum,
  fraisFixes,
}: {
  id: string;
  prixParNuit: number;
  sejourMinimum?: number;
  fraisFixes: Frais[];
}) {
  const t = useT();
  const [frais, setFrais] = useState<Frais[]>(fraisFixes.length ? fraisFixes : [{ libelle: "", montant: 0 }]);

  return (
    <form action={sauverTarifs} className="space-y-6">
      <input type="hidden" name="id" value={id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          nom="prixParNuit"
          libelle={t("prestataire.tarifsPrix")}
          type="number"
          min={1000}
          pas={1000}
          defaut={prixParNuit}
          requis
        />
        <Champ
          nom="sejourMinimum"
          libelle={t("prestataire.tarifsSejourMinimum")}
          aide={t("prestataire.tarifsSejourAide")}
          type="number"
          min={1}
          defaut={sejourMinimum}
        />
      </div>

      <fieldset className="space-y-3 rounded-card border border-contour bg-surface p-4">
        <legend className="px-1 text-titre-3 text-encre">{t("prestataire.tarifsFrais")}</legend>
        <p className="text-petit text-encre-douce">{t("prestataire.tarifsFraisAide")}</p>

        {frais.map((ligne, i) => (
          <div key={i} className="flex items-end gap-3">
            <Champ
              nom="fraisLibelle"
              libelle={t("prestataire.tarifsLibelle")}
              defaut={ligne.libelle}
              className="flex-1"
            />
            <Champ
              nom="fraisMontant"
              libelle={t("prestataire.tarifsMontant")}
              type="number"
              min={0}
              pas={1000}
              defaut={ligne.montant || undefined}
              className="w-[140px]"
            />
            <button
              type="button"
              onClick={() => setFrais((liste) => liste.filter((_, j) => j !== i))}
              aria-label={t("prestataire.photosSupprimer")}
              className="mb-1 flex h-[var(--size-touch)] w-[var(--size-touch)] shrink-0 items-center justify-center rounded-pill text-danger hover:bg-teinte-rouge"
            >
              <Icone nom="fermeture" taille={20} />
            </button>
          </div>
        ))}

        <Bouton
          variante="secondaire"
          largeur="contenu"
          icone="plus"
          onClick={() => setFrais((liste) => [...liste, { libelle: "", montant: 0 }])}
        >
          {t("prestataire.tarifsFrais")}
        </Bouton>
      </fieldset>

      <Bouton type="submit" variante="principal" largeur="pleine">
        {t("prestataire.tarifsEnregistrer")}
      </Bouton>
    </form>
  );
}

function Champ({
  nom,
  libelle,
  aide,
  type = "text",
  min,
  pas,
  defaut,
  requis,
  className,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  type?: string;
  min?: number;
  pas?: number;
  defaut?: string | number;
  requis?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-petit text-encre">
        {libelle}
        <input
          name={nom}
          type={type}
          min={min}
          step={pas}
          defaultValue={defaut}
          required={requis}
          inputMode={type === "number" ? "numeric" : undefined}
          className="mt-1 min-h-[var(--size-control)] w-full rounded-control border border-contour-champ bg-surface px-3 text-corps text-encre chiffres-tabulaires outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primaire"
        />
      </label>
      {aide && <p className="text-petit text-encre-douce">{aide}</p>}
    </div>
  );
}
