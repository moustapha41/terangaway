import { notFound } from "next/navigation";
import { Bandeau } from "@teranga/ui";
import { OngletsOffre } from "@/components/prestataire/onglets-offre";
import { GestionPhotos } from "@/features/prestataire/gestion-photos";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { offreDuPartenaire } from "@/mocks/api";

export default async function Photos({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ creee?: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { creee } = await searchParams;
  const t = traducteurPour(langue);

  const offre = await offreDuPartenaire(id);
  if (!offre) notFound();

  return (
    <>
      <main className="max-w-[800px] space-y-6">
        <OngletsOffre offre={offre} langue={langue} actif="photos" />

        {creee && <Bandeau variante="succes">{t("prestataire.offreCreee")}</Bandeau>}

        <section className="space-y-4">
          <h2 className="text-titre-2 text-encre">{t("prestataire.photosTitre")}</h2>
          <p className="max-w-[70ch] text-corps text-encre-douce">{t("prestataire.photosTexte")}</p>
          <GestionPhotos existantes={offre.logement.photos} />
        </section>
      </main>
    </>
  );
}
