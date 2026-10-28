"use client";

import Image from "next/image";
import { useState } from "react";
import type { Logement } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import { CarteTuiles } from "@/lib/carte/carte-tuiles";
import { Lien } from "@/lib/i18n/lien";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { titreLogement } from "@/lib/i18n/titre-logement";
import { formaterMontantVisiteur, formaterPrixVisiteur, prixAffiche } from "@/lib/prix";
import { ConversionPrix } from "@/components/visiteur/conversion-prix";

/**
 * Vue carte des résultats — maquette écran 07.
 *
 * Les repères portent le prix, pas une épingle anonyme : c'est le prix qui fait
 * choisir, et le voir sur la carte évite d'ouvrir dix fiches.
 *
 * La position est celle du **quartier**, jamais l'adresse exacte : celle-ci
 * n'existe pas côté visiteur avant la confirmation.
 */
export function VueCarte({
  logements,
  parametres,
}: {
  logements: Logement[];
  parametres?: string;
}) {
  const t = useT();
  const langue = useLangue();
  const [choisi, setChoisi] = useState<string | null>(null);

  const situes = logements.filter((l) => l.position);
  const actif = situes.find((l) => l.id === choisi) ?? null;

  return (
    <div className="relative">
      <CarteTuiles
        etiquette={t("resultats.vueCarte")}
        className="h-[560px] w-full"
        reperes={situes.map((logement) => ({
          id: logement.id,
          latitude: logement.position!.latitude,
          longitude: logement.position!.longitude,
          libelle: `${formaterMontantVisiteur(Math.round(prixAffiche(logement).montant / 1000), langue)}K`,
          actif: logement.id === choisi,
          onClick: () => setChoisi((id) => (id === logement.id ? null : logement.id)),
        }))}
      />

      {actif && (
        <article className="absolute inset-x-3 bottom-3 z-20 overflow-hidden rounded-card border border-contour bg-surface shadow-[0_18px_40px_-12px_rgb(2_20_38/0.3)] sm:inset-x-auto sm:left-3 sm:w-[340px]">
          <div className="flex gap-3 p-3">
            <span className="relative h-20 w-24 shrink-0 overflow-hidden rounded-control bg-champ">
              <Image
                src={actif.photos[0].url}
                alt={actif.photos[0].alt}
                fill
                sizes="96px"
                className="object-cover"
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-titre-3 text-encre">
                <Lien href={`/logements/${actif.slug}${parametres ? `?${parametres}` : ""}`}>
                  {titreLogement(actif, t)}
                </Lien>
              </p>
              <p className="mt-0.5 text-petit text-encre-douce">
                {actif.quartier}, {actif.ville}
              </p>
              <p className="mt-1.5 text-petit font-semibold text-encre chiffres-tabulaires">
                {formaterPrixVisiteur(prixAffiche(actif).montant, langue)}
                <span className="ml-1 font-normal text-encre-douce">{t(prixAffiche(actif).cleUnite)}</span>
              </p>
              <p className="text-legende text-encre-douce chiffres-tabulaires">
                {formaterPrixVisiteur(actif.prixParNuit, langue)} {t("commun.parNuit")}
              </p>
              <ConversionPrix
                montant={prixAffiche(actif).montant}
                unite={t(prixAffiche(actif).cleUnite)}
              />
            </div>

            <button
              type="button"
              onClick={() => setChoisi(null)}
              aria-label={t("demande.fermer")}
              className="h-8 w-8 shrink-0 rounded-pill text-encre-douce hover:bg-champ"
            >
              <Icone nom="fermeture" taille={20} className="mx-auto" />
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
