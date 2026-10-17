import { EnTeteSession } from "@/components/layout/en-tete-session";
import { BandeauConfianceTransport } from "@/components/visiteur/bandeau-confiance-transport";
import { HeroTransport } from "@/components/visiteur/hero-transport";
import { NosServicesTransport } from "@/components/visiteur/nos-services-transport";
import { ParcVehicules } from "@/components/visiteur/parc-vehicules";
import { estLangue } from "@/lib/i18n/langues";

/**
 * Écran Transport — landing calée sur `transport/Dalal Transport Booking UI Mockup.png`.
 *
 * Hero + carte de recherche (4 besoins), bandeau confiance, **le parc**, grille
 * des services. Les recherches redirigent vers trajet / location / taxi déjà en
 * place ; le parc, lui, s'affiche sans qu'on ait rien à saisir.
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
      <EnTeteSession />
      <HeroTransport langue={langue} />
      <BandeauConfianceTransport langue={langue} />
      <ParcVehicules langue={langue} />
      <NosServicesTransport langue={langue} />
    </main>
  );
}
