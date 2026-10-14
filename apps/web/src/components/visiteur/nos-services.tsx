import Image from "next/image";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { ArrowRight, Car, ChevronRight, House } from "lucide-react";

const SERVICES = [
  { cle: "logements", href: "/logements", image: "/images/service-logement.png", icone: House },
  { cle: "transports", href: "/transports", image: "/images/service-transport.png", icone: Car },
] as const;

export function NosServices({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="bg-fond">
      <div className="mx-auto w-[87.5%] max-w-[1260px] py-14 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
              {t("services.surtitre")}
            </p>
            <span className="mt-2 block h-[3px] w-[42px] rounded-full bg-jaune-vif" />
            <h2 className="mt-3 text-[clamp(26px,2.6vw,34px)] font-bold tracking-[-0.02em] text-nuit">
              {t("services.titre")}
            </h2>
          </div>

          <Lien
            href="/services"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-nuit underline decoration-nuit/30 underline-offset-4 transition-colors hover:decoration-nuit"
          >
            {t("services.tousLesServices")}
            <ArrowRight strokeWidth={2} className="h-4 w-4" />
          </Lien>
        </div>

        <div className="mt-8 grid gap-5 md:mt-10 md:grid-cols-2 md:gap-6">
          {SERVICES.map((service) => {
            const Icone = service.icone;
            return (
              <Lien
                key={service.cle}
                href={service.href}
                className="group relative block aspect-[16/10] overflow-hidden rounded-[18px] md:aspect-[5/3]"
              >
                <Image
                  src={service.image}
                  alt={t(`services.${service.cle}Alt`)}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />

                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,29,53,0) 45%, rgba(0,29,53,0.55) 72%, rgba(0,29,53,0.82) 100%)",
                  }}
                />

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-6">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white text-nuit shadow-sm">
                      <Icone strokeWidth={1.7} className="h-[22px] w-[22px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[20px] font-bold leading-tight text-white md:text-[22px]">
                        {t(`services.${service.cle}Titre`)}
                      </span>
                      <span className="mt-1 block max-w-[320px] text-[13.5px] leading-snug text-white/90 md:text-[14.5px]">
                        {t(`services.${service.cle}Detail`)}
                      </span>
                    </span>
                  </div>

                  <span className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-nuit transition-transform duration-300 group-hover:translate-x-0.5">
                    <ChevronRight strokeWidth={2.2} className="h-5 w-5" />
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
