import { notFound } from "next/navigation";
import { OngletsOffre } from "@/components/prestataire/onglets-offre";
import { GestionTarifs } from "@/features/prestataire/gestion-tarifs";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { offreDuPartenaire } from "@/mocks/api";

export default async function Tarifs({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const offre = await offreDuPartenaire(id);
  if (!offre) notFound();

  return (
    <>
      <main className="max-w-[700px] space-y-6">
        <OngletsOffre offre={offre} langue={langue} actif="tarifs" />

        <section className="space-y-4">
          <h2 className="text-titre-2 text-encre">{t("prestataire.tarifsTitre")}</h2>
          <GestionTarifs
            id={offre.id}
            prixParNuit={offre.logement.prixParNuit}
            sejourMinimum={offre.logement.sejourMinimum}
            fraisFixes={offre.logement.fraisFixes ?? []}
          />
        </section>
      </main>
    </>
  );
}
