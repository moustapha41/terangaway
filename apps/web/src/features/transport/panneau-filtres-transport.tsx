"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CATEGORIES_VEHICULE, OFFRES_TRANSPORT } from "@teranga/contracts";
import { Carte, Champ } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";

/**
 * Filtres des résultats transport — maquette transport, écran 2.
 *
 * L'URL porte l'état, comme pour les logements : une recherche filtrée se
 * partage, se met en favori et survit au rechargement. Chaque changement est
 * un `replace`, pas un `push` — sinon le bouton Retour remonterait un à un
 * tous les réglages au lieu de ramener à l'écran précédent.
 *
 * Le décompte affiché à côté de chaque case est calculé sur le catalogue réel,
 * pas inventé : une case qui annonce zéro se voit avant d'être cochée.
 */
const PLAGES_PASSAGERS = [
  { cle: "1-3", min: 1, max: 3 },
  { cle: "4-6", min: 4, max: 6 },
  { cle: "7+", min: 7, max: 99 },
];

const OPTIONS = ["climatisation", "grandeValise", "anglophone"] as const;

export function PanneauFiltresTransport({
  comptes,
}: {
  /** Nombre de véhicules par valeur de filtre, calculé côté serveur. */
  comptes: {
    service: Record<string, number>;
    categorie: Record<string, number>;
    places: Record<string, number>;
  };
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

  const basculer = (nom: string, valeur: string) => {
    const actuels = (params.get(nom) ?? "").split(",").filter(Boolean);
    const suivants = actuels.includes(valeur)
      ? actuels.filter((x) => x !== valeur)
      : [...actuels, valeur];
    poser(nom, suivants.length > 0 ? suivants.join(",") : null);
  };

  const coche = (nom: string, valeur: string) =>
    (params.get(nom) ?? "").split(",").includes(valeur);

  const aDesFiltres = ["service", "categorie", "places", "options", "prixMin", "prixMax"].some(
    (n) => params.get(n),
  );

  return (
    <Carte className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-titre-3 text-encre">{t("resultatsTransport.filtres")}</h2>
        {aDesFiltres && (
          <button
            type="button"
            onClick={() => demarrer(() => router.replace("?", { scroll: false }))}
            className="min-h-[var(--size-touch)] text-petit font-semibold text-primaire underline underline-offset-2"
          >
            {t("resultatsTransport.reinitialiser")}
          </button>
        )}
      </div>

      <Groupe titre={t("resultatsTransport.typeService")}>
        {OFFRES_TRANSPORT.map((offre) => (
          <CaseCompte
            key={offre}
            libelle={t(`offreTransport.${offre}`)}
            nombre={comptes.service[offre] ?? 0}
            coche={coche("service", offre)}
            onChange={() => basculer("service", offre)}
          />
        ))}
      </Groupe>

      <Groupe titre={t("resultatsTransport.prix")}>
        <div className="grid grid-cols-2 gap-3">
          <Champ
            libelle={t("resultatsTransport.prixMin")}
            type="number"
            inputMode="numeric"
            tabulaire
            defaultValue={params.get("prixMin") ?? ""}
            onBlur={(e) => poser("prixMin", e.target.value || null)}
          />
          <Champ
            libelle={t("resultatsTransport.prixMax")}
            type="number"
            inputMode="numeric"
            tabulaire
            defaultValue={params.get("prixMax") ?? ""}
            onBlur={(e) => poser("prixMax", e.target.value || null)}
          />
        </div>
      </Groupe>

      <Groupe titre={t("resultatsTransport.typeVehicule")}>
        {CATEGORIES_VEHICULE.map((categorie) => (
          <CaseCompte
            key={categorie}
            libelle={t(`categorieVehicule.${categorie}`)}
            nombre={comptes.categorie[categorie] ?? 0}
            coche={coche("categorie", categorie)}
            onChange={() => basculer("categorie", categorie)}
          />
        ))}
      </Groupe>

      <Groupe titre={t("resultatsTransport.nombrePassagers")}>
        <div className="flex flex-wrap gap-2">
          {PLAGES_PASSAGERS.map((plage) => {
            const actif = params.get("places") === plage.cle;
            return (
              <button
                key={plage.cle}
                type="button"
                aria-pressed={actif}
                onClick={() => poser("places", actif ? null : plage.cle)}
                className={
                  "inline-flex min-h-[var(--size-touch)] items-center gap-1.5 rounded-pill border px-4 text-petit font-semibold " +
                  (actif
                    ? "border-primaire bg-primaire text-white"
                    : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
                }
              >
                {plage.cle}
                <span className="text-legende font-normal opacity-70 chiffres-tabulaires">
                  ({comptes.places[plage.cle] ?? 0})
                </span>
              </button>
            );
          })}
        </div>
      </Groupe>

      <Groupe titre={t("resultatsTransport.options")} dernier>
        {OPTIONS.map((option) => (
          <CaseCompte
            key={option}
            libelle={t(
              `resultatsTransport.option${option[0].toUpperCase()}${option.slice(1)}`,
            )}
            coche={coche("options", option)}
            onChange={() => basculer("options", option)}
          />
        ))}
      </Groupe>
    </Carte>
  );
}

function Groupe({
  titre,
  children,
  dernier = false,
}: {
  titre: string;
  children: React.ReactNode;
  dernier?: boolean;
}) {
  return (
    <fieldset className={dernier ? "mt-5" : "mt-5 border-b border-contour pb-5"}>
      <legend className="mb-2 text-petit font-semibold text-encre">{titre}</legend>
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function CaseCompte({
  libelle,
  nombre,
  coche,
  onChange,
}: {
  libelle: string;
  nombre?: number;
  coche: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-[var(--size-touch)] items-center gap-3 text-petit text-encre">
      <input
        type="checkbox"
        checked={coche}
        onChange={onChange}
        className="h-5 w-5 shrink-0 accent-[var(--color-primaire)]"
      />
      <span className="flex-1">{libelle}</span>
      {nombre !== undefined && (
        <span className="text-legende text-encre-douce chiffres-tabulaires">({nombre})</span>
      )}
    </label>
  );
}
