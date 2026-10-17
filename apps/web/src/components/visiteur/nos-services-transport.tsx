"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays, Car, ChevronRight, Plane } from "lucide-react";
import { FeuilleBasse } from "@teranga/ui";
import { BarreRechercheTransport } from "@/features/transport/barre-recherche-transport";
import type { Langue } from "@/lib/i18n/langues";
import { useT } from "@/lib/i18n/contexte";

const SERVICES = [
  {
    cle: "transfert",
    onglet: "transfert" as const,
    image: "/images/hero-transport.png",
    position: "object-[center_35%]",
    icone: Plane,
  },
  {
    cle: "chauffeur",
    onglet: "chauffeur" as const,
    image: "/images/service-transport.png",
    position: "object-center",
    icone: Car,
  },
  {
    cle: "location",
    onglet: "location" as const,
    image: "/images/service-transport.png",
    position: "object-[70%_center]",
    icone: CalendarDays,
  },
] as const;

/**
 * Grille des services de transport — maquette transport.
 *
 * Une carte n'emmène plus sur une page : elle ouvre **la recherche elle-même**,
 * déjà réglée sur le service choisi. On remplit, on envoie, on voit les
 * véhicules. La page intermédiaire ne faisait que redemander ce qu'on venait
 * de cliquer, loin de la carte de recherche qu'on avait sous les yeux.
 *
 * Le composant est devenu client pour cette seule raison : la feuille a un
 * état ouvert/fermé. Les textes passent par le contexte de langue, comme
 * partout ailleurs côté navigateur.
 */
export function NosServicesTransport({ langue }: { langue: Langue }) {
  void langue;
  const t = useT();
  const [ouvert, setOuvert] = useState<(typeof SERVICES)[number] | null>(null);

  return (
    <section className="bg-fond">
      <div className="mx-auto w-[87.5%] max-w-[1260px] py-14 md:py-16">
        <h2 className="text-[clamp(24px,2.4vw,32px)] font-bold tracking-[-0.02em] text-nuit">
          {t("transport.services.titre")}
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4 lg:gap-5">
          {SERVICES.map((service) => {
            const Icone = service.icone;
            return (
              <button
                key={service.cle}
                type="button"
                onClick={() => setOuvert(service)}
                aria-haspopup="dialog"
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[18px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire sm:aspect-[3/4]"
              >
                <Image
                  src={service.image}
                  alt={t(`transport.services.${service.cle}Alt`)}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${service.position}`}
                />

                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,29,53,0) 35%, rgba(0,29,53,0.55) 68%, rgba(0,29,53,0.88) 100%)",
                  }}
                />

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 md:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-nuit shadow-sm">
                      <Icone strokeWidth={1.7} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-bold leading-tight text-white md:text-[17px]">
                        {t(`transport.services.${service.cle}Titre`)}
                      </span>
                      <span className="mt-1 block text-[13px] leading-snug text-white/85">
                        {t(`transport.services.${service.cle}Detail`)}
                      </span>
                    </span>
                  </div>

                  <span className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-nuit transition-transform duration-300 group-hover:translate-x-0.5">
                    <ChevronRight strokeWidth={2.2} className="h-4 w-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* La feuille du service ouvert. Montée sur `FeuilleBasse`, donc fermable
          par Échap, par le fond et par sa croix — sans qu'on ait à le réécrire. */}
      <FeuilleBasse
        ouverte={ouvert !== null}
        onFermer={() => setOuvert(null)}
        titre={ouvert ? t(`transport.services.${ouvert.cle}Titre`) : ""}
        etiquetteFermer={t("transport.services.fermer")}
      >
        {ouvert && (
          <div className="space-y-4">
            {/* Une phrase pour situer, puis la saisie. Ni photo ni promesses :
                on est venu remplir un formulaire, pas lire une brochure. */}
            <p className="text-petit text-encre-douce">
              {t(`transport.services.${ouvert.cle}Texte`)}
            </p>

            <BarreRechercheTransport onglet={ouvert.onglet} nu />
          </div>
        )}
      </FeuilleBasse>
    </section>
  );
}
