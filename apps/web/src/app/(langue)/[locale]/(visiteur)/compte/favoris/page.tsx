import { ListeFavoris } from "@/features/client/liste-favoris";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { LOGEMENTS } from "@/mocks/fixtures/logements";

/** Mes favoris — la sélection vit dans le navigateur, le catalogue vient du serveur. */
export default async function Favoris({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <div className="max-w-[760px]">
      <h1 className="mb-5 text-titre-1 text-encre">{t("client.favorisTitre")}</h1>
      <ListeFavoris catalogue={LOGEMENTS} />
    </div>
  );
}
