import { Icone } from "@teranga/ui";
import { CarteReperes } from "@/features/services/carte-reperes";
// Les positions des lieux desservis vivent avec la recherche transport, qui
// s'en sert pour rapprocher le téléphone du lieu le plus proche. Une seconde
// table ici dériverait de celle-là au premier déplacement de site.
import { situer } from "@/features/transport/zones";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { lieux } from "@/mocks/api";

/**
 * Repère — la carte des points de repère du séjour.
 *
 * C'est le seul service qui ne se demande pas : il n'y a rien à chercher pour
 * le visiteur, seulement à regarder. La page est donc une carte, pas un
 * formulaire, et elle lit la même liste de lieux que la recherche transport —
 * par la couture, comme tout le reste.
 */
export default async function Repere({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const situes = situer(await lieux());

  return (
    <main className="bg-page pb-16">
      <div className="mx-auto w-[92%] max-w-[1260px] pt-6">
        <nav className="flex flex-wrap items-center gap-2 text-petit text-encre-douce">
          <Lien href="/" className="hover:text-primaire">
            {t("navigation.accueil")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <Lien href="/services" className="hover:text-primaire">
            {t("services.nosServices")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <span className="text-encre">{t("services.repereTitre")}</span>
        </nav>

        <h1 className="mt-4 text-titre-1 text-encre">{t("services.repereTitre")}</h1>
        <p className="mt-2 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("repere.intro")}
        </p>

        <div className="mt-7">
          <CarteReperes lieux={situes} />
        </div>
      </div>
    </main>
  );
}
