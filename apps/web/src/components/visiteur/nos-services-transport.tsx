import Image from "next/image";
import { CalendarDays, Car, ChevronRight, Plane } from "lucide-react";
import { Lien } from "@/lib/i18n/lien";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

const SERVICES = [
  {
    cle: "transfert",
    href: "/transports/trajet",
    image: "/images/hero-transport.png",
    position: "object-[center_35%]",
    icone: Plane,
  },
  {
    cle: "chauffeur",
    href: "/transports/trajet",
    image: "/images/service-transport.png",
    position: "object-center",
    icone: Car,
  },
  {
    cle: "location",
    href: "/transports/location",
    image: "/images/service-transport.png",
    position: "object-[70%_center]",
    icone: CalendarDays,
  },
  {
    cle: "taxi",
    href: "/transports/taxi",
    image: "/images/hero-transport.png",
    position: "object-[80%_60%]",
    icone: Car,
  },
] as const;

/**
 * Grille des 4 services — maquette transport.
 * Photos HQ (pas les crops flous de la planche) + texte en overlay, comme
 * la section « Nos services » de l'accueil.
 */
export function NosServicesTransport({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

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
              <Lien
                key={service.cle}
                href={service.href}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[18px] sm:aspect-[3/4]"
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
              </Lien>
            );
          })}
        </div>
      </div>
    </section>
  );
}
