import { BadgeStatut, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { dureeRestante, formaterPlage } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { demandesRecues } from "@/mocks/api";

/** Les demandes reçues, celles sans réponse d'abord : c'est leur délai qui court. */
export default async function Demandes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);
  const demandes = await demandesRecues();

  return (
    <>

      <main>
        <h1 className="text-titre-1 text-encre">{t("prestataire.mesDemandes")}</h1>

        <ul className="mt-6 space-y-4">
          {demandes.map((demande) => (
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
                    {demande.expireLe && (
                      <span className="mt-2 inline-flex items-center gap-1 text-petit font-semibold text-alerte">
                        <Icone nom="horloge" taille={16} />
                        {t("prestataire.repondreAvant", {
                          duree: dureeRestante(new Date(demande.expireLe), langue),
                        })}
                      </span>
                    )}
                  </span>
                  <Icone nom="chevron-droite" taille={20} className="shrink-0 text-encre-douce" />
                </Lien>
              </Carte>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
