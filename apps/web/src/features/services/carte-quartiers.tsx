"use client";

import { useState } from "react";
import { Bouton, Icone } from "@teranga/ui";
import { CarteTuiles } from "@/lib/carte/carte-tuiles";
import { Lien } from "@/lib/i18n/lien";
import { useT } from "@/lib/i18n/contexte";
import { QUARTIERS_TABLE } from "./restauration";

/**
 * Les quartiers où l'on mange, en liste et sur la carte.
 *
 * Le même principe que la galerie des sites : la sélection vit dans l'état,
 * parce qu'on ouvre et referme en parcourant, et seul le lien de demande porte
 * le quartier dans son adresse — celui-là se partage et amorce le formulaire.
 *
 * Aucun établissement n'est nommé, par choix : une adresse ferme, et une page
 * qui la recommande encore trahit le visiteur qui s'y rend.
 */
export function CarteQuartiers() {
  const t = useT();
  const [choisi, setChoisi] = useState<string | null>(null);
  const ouvert = QUARTIERS_TABLE.find((q) => q.cle === choisi) ?? null;

  const nom = (cle: string) => t(`restauration.quartier.${cle}Nom`);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
        <CarteTuiles
          className="h-[300px] w-full overflow-hidden rounded-card border border-contour sm:h-[360px]"
          etiquette={t("restauration.carteEtiquette")}
          reperes={QUARTIERS_TABLE.map((quartier) => ({
            id: quartier.cle,
            latitude: quartier.latitude,
            longitude: quartier.longitude,
            libelle: nom(quartier.cle),
            actif: ouvert?.cle === quartier.cle,
            onClick: () => setChoisi(quartier.cle),
          }))}
        />
        <p className="mt-2 text-legende text-encre-douce">{t("restauration.carteNote")}</p>

        {ouvert && (
          <div className="mt-4 rounded-card border border-contour bg-surface p-5">
            <h3 className="text-titre-2 text-encre">{nom(ouvert.cle)}</h3>
            <p className="mt-2 text-corps leading-relaxed text-encre-douce">
              {t(`restauration.quartier.${ouvert.cle}Texte`)}
            </p>
            <Lien
              href={`/services/restauration?quartier=${ouvert.cle}#demande`}
              className="mt-4 block"
            >
              <Bouton variante="principal" largeur="contenu">
                <span className="inline-flex items-center gap-2">
                  {t("restauration.demanderPour")}
                  <Icone nom="chevron-droite" taille={16} />
                </span>
              </Bouton>
            </Lien>
          </div>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:order-1 lg:grid-cols-1">
        {QUARTIERS_TABLE.map((quartier) => {
          const actif = ouvert?.cle === quartier.cle;
          return (
            <li key={quartier.cle}>
              <button
                type="button"
                aria-expanded={actif}
                onClick={() => setChoisi(actif ? null : quartier.cle)}
                className={
                  "flex w-full gap-3 rounded-card border p-4 text-left transition-colors " +
                  (actif
                    ? "border-primaire bg-teinte-bleu"
                    : "border-contour bg-surface hover:border-primaire/40")
                }
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom="restauration" taille={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-petit font-semibold text-encre">
                    {nom(quartier.cle)}
                  </span>
                  <span className="mt-0.5 block text-legende leading-relaxed text-encre-douce">
                    {t(`restauration.quartier.${quartier.cle}Texte`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
