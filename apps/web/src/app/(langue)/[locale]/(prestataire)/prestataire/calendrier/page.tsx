import { Bandeau } from "@teranga/ui";
import { Calendrier, type Evenement } from "@/features/prestataire/calendrier";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { demandesRecues } from "@/mocks/api";

/** Calendrier des réservations — maquette du collage prestataire, écran 7. */
const STATUT: Record<string, Evenement["statut"]> = {
  envoyee: "attente",
  acceptee: "confirme",
  confirmee: "confirme",
  terminee: "confirme",
  refusee: "refuse",
  expiree: "discussion",
  annulee: "refuse",
};

export default async function PageCalendrier({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const demandes = await demandesRecues();
  const evenements: Evenement[] = demandes.map((d) => ({
    id: d.id,
    titre: d.offreTitre,
    sousTitre: d.reference,
    debut: d.dates.debut,
    fin: d.dates.fin,
    statut: STATUT[d.statut] ?? "attente",
  }));

  return (
    <>

      <main>
        <h1 className="text-titre-1 text-encre">{t("prestataire.calendrier")}</h1>
        <p className="mt-1 text-corps text-encre-douce">{t("prestataire.calendrierTexte")}</p>

        <div className="mt-6">
          <Calendrier evenements={evenements} />
        </div>

        <div className="mt-6">
          <Bandeau variante="information">{t("prestataire.indisponibiliteTexte")}</Bandeau>
        </div>
      </main>
    </>
  );
}
