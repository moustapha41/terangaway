import { EnTete } from "@/components/layout/en-tete";
import { PiedDePage } from "@/components/layout/pied-de-page";
import { BarreDuBas } from "@/components/layout/barre-du-bas";
import { estLangue } from "@/lib/i18n/langues";

/** Les pages publiques portent la même enveloppe que les écrans visiteur. */
export default async function LayoutPublic({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";

  return (
    <>
      <EnTete />
      {children}
      <PiedDePage langue={langue} />
      <div aria-hidden="true" className="h-[72px] lg:hidden" />
      <BarreDuBas />
    </>
  );
}
