import Image from "next/image";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { BarreRechercheTransport } from "@/features/transport/barre-recherche-transport";

/**
 * Hero de la page Transport — maquette `transport/Dalal Transport Booking UI Mockup.png`.
 */
export function HeroTransport({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="relative w-full pb-2">
      <div className="relative h-[min(560px,max(420px,36vw))] w-full overflow-hidden">
        <Image
          src="/images/hero-transport.png"
          alt={t("transport.accueil.alt")}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,29,53,0.78) 0%, rgba(0,29,53,0.58) 28%, rgba(0,29,53,0.28) 55%, rgba(0,29,53,0.08) 78%, rgba(0,29,53,0) 100%)",
          }}
        />

        <div className="relative mx-auto flex h-full w-[87.5%] max-w-[1260px] flex-col justify-center pb-[120px] pt-6">
          <h1 className="max-w-[640px] text-[clamp(32px,4vw,52px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            {t("transport.accueil.titre")}
          </h1>
          <p className="mt-4 max-w-[480px] text-[clamp(16px,1.4vw,19px)] leading-[1.45] text-white/90">
            {t("transport.accueil.sousTitre")}
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-[140px] w-[87.5%] max-w-[900px]">
        <BarreRechercheTransport />
      </div>
    </section>
  );
}
