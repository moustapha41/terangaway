import { EnTete } from "@/components/layout/en-tete";
import { BandeauConfianceTransport } from "@/components/visiteur/bandeau-confiance-transport";
import { HeroTransport } from "@/components/visiteur/hero-transport";
import { NosServicesTransport } from "@/components/visiteur/nos-services-transport";
import { estLangue } from "@/lib/i18n/langues";

/**
 * Écran Transport — landing calée sur `transport/Dalal Transport Booking UI Mockup.png`.
 *
 * Hero + carte de recherche (4 besoins), bandeau confiance, grille des services.
 * Les recherches redirigent vers trajet / location / taxi déjà en place.
 */
export default async function Transports({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";

  return (
    <main>
      <EnTete />
      <HeroTransport langue={langue} />
      <BandeauConfianceTransport langue={langue} />
      <NosServicesTransport langue={langue} />
    </main>
  );
}
