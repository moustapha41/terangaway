import { Headphones, MapPin, ShieldCheck, Tag } from "lucide-react";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";

const POINTS = [
  { cle: "partenaires", icone: ShieldCheck, fond: "bg-[#f3e2b8]", trait: "text-[#c4922e]" },
  { cle: "prix", icone: Tag, fond: "bg-[#f3e2b8]", trait: "text-[#c4922e]" },
  { cle: "assistance", icone: Headphones, fond: "bg-[#dce8f5]", trait: "text-nuit" },
  { cle: "proximite", icone: MapPin, fond: "bg-[#f3e2b8]", trait: "text-[#c4922e]" },
] as const;

export function BandeauConfiance({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="border-b border-bordure/70 bg-white">
      <div className="mx-auto grid w-[87.5%] max-w-[1260px] gap-8 pb-10 pt-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:pb-12 lg:pt-[72px]">
        {POINTS.map((point) => {
          const Icone = point.icone;
          return (
            <div key={point.cle} className="flex items-center gap-3.5">
              <span
                className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full ${point.fond}`}
              >
                <Icone strokeWidth={1.7} className={`h-[22px] w-[22px] ${point.trait}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight text-nuit">
                  {t(`confiance.${point.cle}Titre`)}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-gris">
                  {t(`confiance.${point.cle}Detail`)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
