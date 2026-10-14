import { EnTete } from "@/components/layout/en-tete";
import { BandeauConfiance } from "@/components/visiteur/bandeau-confiance";
import { BandeauDakar } from "@/components/visiteur/bandeau-dakar";
import { EpopeeDakar } from "@/components/visiteur/epopee-dakar";
import { HebergementsRecommandes } from "@/components/visiteur/hebergements-recommandes";
import { Hero } from "@/components/visiteur/hero";
import { NosServices } from "@/components/visiteur/nos-services";
import { estLangue } from "@/lib/i18n/langues";

/**
 * Écran 1 · Accueil.
 *
 * Les sections statiques reçoivent la langue en propriété et restent des
 * composants serveur : elles ne partent pas dans le navigateur. Seuls l'en-tête
 * et la barre de recherche, qui ont un état, utilisent le contexte.
 */
export default async function Accueil({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";

  return (
    <main>
      <EnTete />
      <Hero langue={langue} />
      <BandeauConfiance langue={langue} />
      <NosServices langue={langue} />
      <HebergementsRecommandes langue={langue} />
      <BandeauDakar langue={langue} />
      <EpopeeDakar langue={langue} />
    </main>
  );
}
