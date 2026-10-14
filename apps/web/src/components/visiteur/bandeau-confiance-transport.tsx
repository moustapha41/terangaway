import { Clock, Headphones, ShieldCheck, Tag } from "lucide-react";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

const POINTS = [
  { cle: "chauffeurs", icone: ShieldCheck },
  { cle: "disponibilite", icone: Clock },
  { cle: "prix", icone: Tag },
  { cle: "assistance", icone: Headphones },
] as const;

export function BandeauConfianceTransport({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="bg-white">
      <div className="mx-auto grid w-[87.5%] max-w-[1260px] gap-8 pb-10 pt-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:pb-12 lg:pt-[72px]">
        {POINTS.map((point) => {
          const Icone = point.icone;
          return (
            <div key={point.cle} className="flex items-center gap-3.5">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-teinte-vert text-succes">
                <Icone strokeWidth={1.7} className="h-[22px] w-[22px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight text-nuit">
                  {t(`transport.confiance.${point.cle}`)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
