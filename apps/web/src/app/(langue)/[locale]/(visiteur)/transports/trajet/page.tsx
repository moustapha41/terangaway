import { Suspense } from "react";
import { Bandeau, Bouton, Icone } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { CarteVehicule } from "@/components/visiteur/carte-vehicule";
import { FormulaireTrajet } from "@/features/transport/formulaire-trajet";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { chercherVehicules, DelaiTropCourt, type EtatSimule, lieux } from "@/mocks/api";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Écran 7 · Trajet avec chauffeur : le formulaire, puis les véhicules (§C.7).
 *
 * Le cas bloquant des deux heures est appliqué par l'API, pas par le formulaire :
 * une URL forgée à la main ne doit pas pouvoir le contourner.
 */
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

export default async function Trajet({
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

  const aCherche = Boolean(recherche.quand);

  return (
    <main className="bg-page pb-16">
      <EnTete />
      <div className="mx-auto w-[87.5%] max-w-[900px] pt-6">
        <Lien href="/transports" className="inline-flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="retour" taille={16} />
          {t("transport.titre")}
        </Lien>

        <h1 className="mb-6 mt-4 text-titre-1 text-encre">{t("transport.trajetTitre")}</h1>

        <div className="max-w-[560px]">
          <Suspense fallback={null}><FormulaireTrajet lieux={await suggestions()} /></Suspense>
        </div>

        {aCherche && (
          <div className="mt-10">
            <Resultats langue={langue} recherche={recherche} />
          </div>
        )}
      </div>
    </main>
  );
}

async function Resultats({
  langue,
  recherche,
}: {
  langue: Langue;
  recherche: Record<string, string | undefined>;
}) {
  const t = traducteurPour(langue);

  let vehicules;
  try {
    vehicules = await chercherVehicules(
      "trajet",
      {
        passagers: Number(recherche.passagers ?? 1),
        bagages: Number(recherche.bagages ?? 0),
        quand: recherche.quand,
      },
      (recherche.etat as EtatSimule) ?? "normal",
    );
  } catch (erreur) {
    if (!(erreur instanceof DelaiTropCourt)) throw erreur;
    // « Envoi bloqué, bouton d'appel de l'aide » (§B.8).
    return (
      <div className="space-y-4">
        <Bandeau variante="avertissement">
          <strong className="block font-semibold">{t("transport.delaiTitre")}</strong>
          {t("transport.delaiTexte")}
        </Bandeau>
        <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}>
          <Bouton variante="principal" largeur="contenu" icone="telephone">
            {t("transport.appelerAide")}
          </Bouton>
        </a>
      </div>
    );
  }

  if (vehicules.length === 0) {
    return (
      <div className="rounded-card border border-contour bg-surface px-6 py-12 text-center">
        <Icone nom="voiture" taille={32} className="mx-auto text-encre-douce" />
        <h2 className="mt-4 text-titre-2 text-encre">{t("transport.videTitre")}</h2>
        <p className="mx-auto mt-2 max-w-[48ch] text-corps text-encre-douce">
          {t("transport.videTexte")}
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-corps font-semibold text-encre" aria-live="polite">
        {t("transport.resultatsTitre", { nombre: vehicules.length })}
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehicules.map((vehicule) => (
          <CarteVehicule key={vehicule.id} vehicule={vehicule} langue={langue} besoin="trajet" />
        ))}
      </div>
      <p className="mt-8 text-petit text-encre-douce">{t("resultats.paiementSurPlace")}</p>
    </>
  );
}
