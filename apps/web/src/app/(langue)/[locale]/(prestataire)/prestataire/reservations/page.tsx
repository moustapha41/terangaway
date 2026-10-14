import { BadgeStatut, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterPlage } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { demandesRecues } from "@/mocks/api";

/** Réservations : les demandes acceptées, confirmées ou terminées. */
export default async function Reservations({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const confirmees = (await demandesRecues()).filter((d) =>
    ["acceptee", "confirmee", "terminee"].includes(d.statut),
  );

  return (
    <>

      <main className="max-w-[900px]">
        <h1 className="text-titre-1 text-encre">{t("prestataire.reservations")}</h1>
        <p className="mt-1 text-corps text-encre-douce">{t("prestataire.reservationsTexte")}</p>

        {confirmees.length === 0 ? (
          <Carte className="mt-6 px-6 py-12 text-center">
            <Icone nom="calendrier" taille={32} className="mx-auto text-encre-douce" />
            <p className="mt-3 text-corps text-encre-douce">{t("prestataire.aucuneDemande")}</p>
          </Carte>
        ) : (
          <ul className="mt-6 space-y-4">
            {confirmees.map((demande) => (
              <li key={demande.id}>
                <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                  <Lien href={`/prestataire/demandes/${demande.id}`} className="flex items-center gap-4 p-5">
                    <span className="min-w-0 flex-1">
                      <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
                      <span className="mt-2 block text-titre-3 text-encre">{demande.offreTitre}</span>
                      <span className="mt-1 block text-petit text-encre-douce chiffres-tabulaires">
                        {formaterPlage(new Date(demande.dates.debut), new Date(demande.dates.fin), langue)}
                        {" · "}
                        {formaterPrix(demande.total, langue)}
                      </span>
                    </span>
                    <Icone nom="chevron-droite" taille={20} className="shrink-0 text-encre-douce" />
                  </Lien>
                </Carte>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
