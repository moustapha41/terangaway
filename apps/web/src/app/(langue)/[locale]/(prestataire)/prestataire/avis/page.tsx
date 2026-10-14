import { Bandeau, Carte } from "@teranga/ui";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterDateComplete } from "@/lib/dates";
import { avisDe } from "@/mocks/fixtures/avis";
import { OFFRES } from "@/mocks/fixtures/prestataire";

/**
 * Avis reçus.
 *
 * Seul un séjour terminé peut produire un avis : la note affichée au visiteur
 * repose donc sur des séjours réels, pas sur des impressions.
 */
export default async function Avis({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const avis = OFFRES.flatMap((offre) =>
    avisDe(offre.logement.id, offre.logement.nombreAvis ?? 0).map((a) => ({
      ...a,
      offre: offre.logement.titre,
    })),
  );

  return (
    <>

      <main className="max-w-[760px]">
        <h1 className="text-titre-1 text-encre">{t("prestataire.avisTitre")}</h1>
        <p className="mt-1 text-corps text-encre-douce">{t("prestataire.avisTexte")}</p>

        {avis.length === 0 ? (
          <div className="mt-6">
            <Bandeau variante="information">{t("prestataire.avisAucun")}</Bandeau>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {avis.map((a) => (
              <li key={a.id}>
                <Carte className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-titre-3 text-encre">{a.auteur}</p>
                    <p className="flex items-center gap-1 text-petit text-encre">
                      <Etoile />
                      <span className="font-semibold chiffres-tabulaires">{a.note}</span>
                      <span className="sr-only">{t("fiche.noteSur", { note: a.note })}</span>
                    </p>
                  </div>
                  <p className="mt-0.5 text-petit text-encre-douce chiffres-tabulaires">
                    {a.offre} · {formaterDateComplete(new Date(a.date), langue)}
                  </p>
                  <p className="mt-2 text-corps text-encre-douce">{a.texte}</p>
                </Carte>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function Etoile() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#F4B942">
      <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8Z" />
    </svg>
  );
}
