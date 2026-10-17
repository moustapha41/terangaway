import { Suspense } from "react";
import { Icone } from "@teranga/ui";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { CarteVehicule } from "@/components/visiteur/carte-vehicule";
import { FormulaireLocation } from "@/features/transport/formulaire-location";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { chercherVehicules, lieux } from "@/mocks/api";

/** Location avec chauffeur, à la journée. Sans chauffeur est hors MVP (§D.1). */
/**
 * Les points de repère proposés à la saisie.
 *
 * Ce sont des suggestions : sans elles le champ reste libre, et le formulaire
 * marche. Une liste vide vaut mieux qu'un écran de panne.
 */
async function suggestions() {
  try {
    return await lieux();
  } catch (erreur) {
    console.error("[transport] suggestions de lieux indisponibles", erreur);
    return [];
  }
}

export default async function Location({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const recherche = await searchParams;
  const t = traducteurPour(langue);

  const aCherche = Boolean(recherche.debut && recherche.fin);
  const vehicules = aCherche
    ? await chercherVehicules("location", { passagers: Number(recherche.passagers ?? 1) })
    : [];

  return (
    <main className="bg-page pb-16">
      <EnTeteSession />
      <div className="mx-auto w-[87.5%] max-w-[900px] pt-6">
        <Lien href="/transports" className="inline-flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="retour" taille={16} />
          {t("transport.titre")}
        </Lien>

        <h1 className="mb-6 mt-4 text-titre-1 text-encre">{t("transport.locationTitre")}</h1>

        <div className="max-w-[560px]">
          <Suspense fallback={null}><FormulaireLocation lieux={await suggestions()} /></Suspense>
        </div>

        {aCherche && (
          <div className="mt-10">
            {vehicules.length === 0 ? (
              <div className="rounded-card border border-contour bg-surface px-6 py-12 text-center">
                <h2 className="text-titre-2 text-encre">{t("transport.videTitre")}</h2>
                <p className="mx-auto mt-2 max-w-[48ch] text-corps text-encre-douce">
                  {t("transport.videTexte")}
                </p>
              </div>
            ) : (
              <>
                <p className="text-corps font-semibold text-encre" aria-live="polite">
                  {t("transport.resultatsTitre", { nombre: vehicules.length })}
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {vehicules.map((vehicule) => (
                    <CarteVehicule key={vehicule.id} vehicule={vehicule} langue={langue} besoin="location" />
                  ))}
                </div>
                <p className="mt-8 text-petit text-encre-douce">{t("resultats.paiementSurPlace")}</p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
