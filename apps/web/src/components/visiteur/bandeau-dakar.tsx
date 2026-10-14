import Image from "next/image";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { ArrowRight } from "lucide-react";

export function BandeauDakar({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="relative w-full overflow-hidden bg-sable">
      <div className="relative aspect-[2170/725] min-h-[300px] w-full md:min-h-[340px]">
        <Image
          src="/images/banner-dakar.png"
          alt={t("dakar.alt")}
          fill
          sizes="100vw"
          className="object-cover object-right"
        />

        <div className="relative z-10 mx-auto flex h-full w-[87.5%] max-w-[1260px] items-center">
          <div className="max-w-[520px] py-10 lg:max-w-[560px]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
              {t("dakar.surtitre")}
            </p>

            <h2 className="mt-3 text-[clamp(26px,2.8vw,36px)] font-bold leading-[1.2] tracking-[-0.02em] text-nuit">
              {t("dakar.titre")}
            </h2>

            <p className="mt-4 max-w-[420px] text-[15px] leading-[1.55] text-nuit/80 md:text-[16px]">
              {t("dakar.texte")}
            </p>

            <Lien
              href="/a-propos"
              className="mt-7 inline-flex w-fit items-center gap-2.5 rounded-full bg-nuit px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-nuit-clair"
            >
              {t("commun.enSavoirPlus")}
              <ArrowRight strokeWidth={2} className="h-4 w-4" />
            </Lien>
          </div>
        </div>
      </div>
    </section>
  );
}
