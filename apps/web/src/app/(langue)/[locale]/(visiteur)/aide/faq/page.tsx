import { Bouton, Icone } from "@teranga/ui";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Écran 15 · Questions fréquentes, par thème.
 *
 * En `<details>` natifs : la page reste lisible et pliable sans JavaScript, et
 * la recherche du navigateur (Ctrl+F) trouve les réponses fermées.
 */
const THEMES = [
  { cle: "reservation", questions: ["compte", "delai", "adresse"] },
  { cle: "paiement", questions: ["paiement", "prix"] },
  { cle: "annulation", questions: ["annuler", "refus"] },
  { cle: "transport", questions: ["deuxHeures"] },
] as const;

export default async function Faq({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="bg-page pb-16">
      <EnTeteSession />

      <div className="mx-auto w-[87.5%] max-w-[700px] pt-6">
        <Lien href="/aide" className="inline-flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="retour" taille={16} />
          {t("aide.titre")}
        </Lien>

        <h1 className="mt-4 text-titre-1 text-encre">{t("aide.faqTitre")}</h1>

        <div className="mt-8 space-y-8">
          {THEMES.map((theme) => (
            <section key={theme.cle} id={theme.cle} className="scroll-mt-6">
              <h2 className="mb-3 text-titre-3 text-encre">{t(`aide.faqTheme.${theme.cle}`)}</h2>
              <div className="divide-y divide-contour overflow-hidden rounded-card border border-contour bg-surface">
                {theme.questions.map((question) => (
                  <details key={question} className="group">
                    <summary className="flex min-h-[var(--size-touch)] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-corps font-semibold text-encre">
                      {t(`aide.q.${question}`)}
                      <Icone
                        nom="chevron"
                        taille={20}
                        className="shrink-0 text-encre-douce transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="px-5 pb-4 text-corps text-encre-douce">
                      {t(`aide.q.${question}R`)}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10">
          <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`} className="block">
            <Bouton variante="secondaire" largeur="pleine" icone="telephone">
              {t("aide.appeler")}
            </Bouton>
          </a>
        </div>
      </div>
    </main>
  );
}
