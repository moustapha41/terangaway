import { notFound } from "next/navigation";
import { Icone } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { FormulaireDemande } from "@/features/demande/formulaire-demande";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import { FormulaireTransport } from "@/features/demande/formulaire-transport";
import { logementParId, vehiculeParId, type EtatEnvoi } from "@/mocks/api";

/**
 * Écran 4 · Demande.
 *
 * L'enveloppe est servie par le serveur ; le formulaire est client parce qu'il
 * garde la saisie à travers le code, l'erreur et le refus (§B.1).
 */
type Params = Promise<{ locale: string; offreId: string }>;
type Recherche = Promise<Record<string, string | undefined>>;



export default async function Demande({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Recherche;
}) {
  const { locale, offreId } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const recherche = await searchParams;
  const t = traducteurPour(langue);

  // Une demande porte sur un logement **ou** sur un véhicule : le contrat
  // `Demande` prévoit les deux genres. Cette page ne cherchait que parmi les
  // logements, si bien que « Demander ce véhicule » tombait sur un 404.
  const logement = await logementParId(offreId);
  const vehicule = logement ? undefined : await vehiculeParId(offreId);
  if (!logement && !vehicule) notFound();

  if (vehicule) {
    const prestation =
      recherche.prestation === "journee" || recherche.prestation === "taxi"
        ? recherche.prestation
        : "trajet";

    return (
      <main className="bg-page pb-16">
        <EnTete />

        <div className="mx-auto w-[87.5%] max-w-[760px] pt-6">
          <Lien
            href={`/transports/${vehicule.slug}`}
            className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
          >
            <Icone nom="retour" taille={16} />
            {vehicule.marque} {vehicule.modele}
          </Lien>

          <h1 className="mb-6 mt-4 text-titre-1 text-encre">
            {t("demandeTransport.titre")}
          </h1>

          <FormulaireTransport
            vehicule={vehicule}
            prestation={prestation}
            depart={recherche.depart ?? recherche.lieu ?? ""}
            arrivee={recherche.arrivee ?? recherche.destination ?? ""}
            quand={recherche.quand ?? `${SEJOUR_DEFAUT.debut}T10:00`}
            passagers={Number(recherche.passagers ?? recherche.personnes ?? 2)}
            etatSimule={(recherche.etat as EtatEnvoi) ?? "normal"}
          />
        </div>
      </main>
    );
  }

  if (!logement) notFound();

  return (
    <main className="bg-page pb-16">
      <EnTete />

      <div className="mx-auto w-[87.5%] max-w-[760px] pt-6">
        <Lien
          href={`/logements/${logement.slug}`}
          className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
        >
          <Icone nom="retour" taille={16} />
          {logement.titre}
        </Lien>

        <h1 className="mb-6 mt-4 text-titre-1 text-encre">{t("demande.titreEtape1")}</h1>

        <FormulaireDemande
          logement={logement}
          debut={recherche.debut ?? SEJOUR_DEFAUT.debut}
          fin={recherche.fin ?? SEJOUR_DEFAUT.fin}
          personnes={Number(recherche.personnes ?? 2)}
          etatSimule={(recherche.etat as EtatEnvoi) ?? "normal"}
        />
      </div>
    </main>
  );
}
