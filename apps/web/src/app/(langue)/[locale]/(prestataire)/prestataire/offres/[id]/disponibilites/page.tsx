import { notFound } from "next/navigation";
import { OngletsOffre } from "@/components/prestataire/onglets-offre";
import { GestionDisponibilites } from "@/features/prestataire/gestion-disponibilites";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { offreDuPartenaire } from "@/mocks/api";

export default async function Disponibilites({
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
        <OngletsOffre offre={offre} langue={langue} actif="disponibilites" />

        <section className="space-y-4">
          <h2 className="text-titre-2 text-encre">{t("prestataire.dispoTitre")}</h2>
          <p className="max-w-[70ch] text-corps text-encre-douce">{t("prestataire.dispoTexte")}</p>
          <GestionDisponibilites id={offre.id} initiales={offre.disponibilites} />
        </section>
      </main>
    </>
  );
}
