"use client";

import { useState } from "react";
import Image from "next/image";
import type { Vehicule } from "@teranga/contracts";
import { Bouton, Icone } from "@teranga/ui";
import { CENTRES_ZONES } from "@/lib/carte/zones";
import { CarteTuiles } from "@/lib/carte/carte-tuiles";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { Lien } from "@/lib/i18n/lien";
import { formaterMontantVisiteur, formaterPrixVisiteur } from "@/lib/prix";

/**
 * Vue carte des transports — maquette transport, écran 3.
 *
 * Elle montre les **zones desservies**, pas des véhicules : un véhicule
 * circule, il n'a pas d'adresse, et le contrat ne lui en donne pas. Chaque
 * repère porte le prix le plus bas disponible dans la zone, et l'ouvrir montre
 * les véhicules qui la desservent.
 *
 * Une zone sans véhicule après filtrage n'apparaît pas : la carte ne promet
 * jamais une couverture qu'on n'a pas.
 */
function prixDe(v: Vehicule) {
  return v.prixParTrajet ?? v.prixParJour ?? 0;
}

export function VueCarteTransport({
  vehicules,
  parametres,
}: {
  vehicules: Vehicule[];
  parametres?: string;
}) {
  const t = useT();
  const langue = useLangue();
  const [zoneOuverte, setZoneOuverte] = useState<string | null>(null);

  // Une zone n'existe sur la carte que si on sait la placer ET qu'un véhicule
  // la dessert après filtrage.
  const zones = Object.keys(CENTRES_ZONES)
    .map((nom) => ({
      nom,
      centre: CENTRES_ZONES[nom],
      vehicules: vehicules.filter((v) => v.zonesCouvertes.includes(nom)),
    }))
    .filter((z) => z.vehicules.length > 0);

  const ouverte = zones.find((z) => z.nom === zoneOuverte) ?? null;

  if (zones.length === 0) return null;

  return (
    <div className="relative">
      <CarteTuiles
        etiquette={t("resultatsTransport.carteEtiquette")}
        className="h-[560px] w-full"
        reperes={zones.map((zone) => {
          const moins = Math.min(...zone.vehicules.map(prixDe));
          return {
            id: zone.nom,
            latitude: zone.centre.latitude,
            longitude: zone.centre.longitude,
            libelle: `${formaterMontantVisiteur(Math.round(moins / 1000), langue)}K`,
            actif: zone.nom === zoneOuverte,
            onClick: () => setZoneOuverte((n) => (n === zone.nom ? null : zone.nom)),
          };
        })}
      />

      {ouverte && (
        <article className="absolute inset-x-3 bottom-3 z-20 overflow-hidden rounded-card border border-contour bg-surface shadow-[0_18px_40px_-12px_rgb(2_20_38/0.3)] sm:inset-x-auto sm:left-3 sm:w-[380px]">
          <div className="flex items-center justify-between gap-3 border-b border-contour px-4 py-3">
            <p className="inline-flex items-center gap-2 text-titre-3 text-encre">
              <Icone nom="repere" taille={20} className="text-primaire" />
              {ouverte.nom}
            </p>
            <button
              type="button"
              onClick={() => setZoneOuverte(null)}
              aria-label={t("resultatsTransport.fermerZone")}
              className="flex h-9 w-9 items-center justify-center rounded-pill text-encre-douce hover:bg-champ"
            >
              <Icone nom="croix" taille={20} />
            </button>
          </div>

          <ul className="max-h-[260px] divide-y divide-contour overflow-y-auto">
            {ouverte.vehicules.map((v) => (
              <li key={v.id}>
                <Lien
                  href={`/transports/${v.slug}${parametres ? `?${parametres}` : ""}`}
                  className="flex items-center gap-3 p-3 hover:bg-champ"
                >
                  <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-control bg-champ">
                    <Image
                      src={v.photos[0].url}
                      alt={v.photos[0].alt}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-petit font-semibold text-encre">
                      {v.marque} {v.modele}
                    </span>
                    <span className="block text-legende text-encre-douce">
                      {t("transport.places", { nombre: v.placesPassagers })}
                    </span>
                  </span>
                  <span className="shrink-0 text-petit font-semibold text-encre chiffres-tabulaires">
                    {formaterPrixVisiteur(prixDe(v), langue)}
                  </span>
                </Lien>
              </li>
            ))}
          </ul>

          <div className="p-3">
            <Lien href={`/transports/resultats${parametres ? `?${parametres}` : ""}`}>
              <Bouton variante="secondaire" largeur="pleine">
                {t("resultatsTransport.toutVoir")}
              </Bouton>
            </Lien>
          </div>
        </article>
      )}
    </div>
  );
}
