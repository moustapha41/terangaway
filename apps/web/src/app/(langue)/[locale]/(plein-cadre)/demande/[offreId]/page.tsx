import Image from "next/image";
import { notFound } from "next/navigation";
import { Car, Home } from "lucide-react";
import { RetourAccueil } from "@/components/layout/retour-accueil";
import { SelecteurLangue } from "@/components/layout/selecteur-langue";
import { Lien } from "@/lib/i18n/lien";
import { FormulaireDemande } from "@/features/demande/formulaire-demande";
import { FormulaireTransport } from "@/features/demande/formulaire-transport";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import { logementParId, vehiculeParId, type EtatEnvoi } from "@/mocks/api";
import { visiteurConnecte } from "@/features/compte/session";
import { lireBrouillonLogement, lireBrouillonTransport } from "@/features/demande/brouillon";
import { formaterPrix } from "@/lib/prix";

/**
 * Écran 4 · Demande — harmonisation premium d'après la page de connexion Teranga Way.
 *
 * 1. Image de Dakar plein écran avec voile bleu nuit protecteur.
 * 2. Boutons de navigation flottants en haut de page (Retour accueil + Sélecteur de langue).
 * 3. Carte centrale blanc cassé / translucide (bg-surface/88, coins 26px, backdrop-blur-xl).
 * 4. Structure interne :
 *    - Logo Teranga Way centré en haut de carte
 *    - Petit badge discret (« Logement » ou « Transport ») + Récapitulatif compact de l'offre
 *    - Titre centré « Faire une demande »
 *    - Indicateur de progression en 3 étapes
 *    - Formulaire régulier et équilibré
 *    - Bouton principal « Continuer » bleu marine avec accent doré au survol
 * 5. Signature « Dakar vous attend » en bas de page.
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

  const visiteur = await visiteurConnecte();
  const visiteurProp = visiteur
    ? { email: visiteur.email, telephone: visiteur.telephone, identifiant: visiteur.identifiant }
    : undefined;

  const logement = await logementParId(offreId);
  const vehicule = logement ? undefined : await vehiculeParId(offreId);
  if (!logement && !vehicule) notFound();

  const prestation =
    recherche.prestation === "journee" || recherche.prestation === "taxi"
      ? recherche.prestation
      : "trajet";

  const prixVehicule = vehicule
    ? prestation === "journee"
      ? (vehicule.prixParJour ?? vehicule.prixParTrajet ?? 0)
      : (vehicule.prixParTrajet ?? vehicule.prixParJour ?? 0)
    : 0;

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-primaire">
      {/* Fond Dakar en plein écran, fixé pour un défilement naturel et fluide */}
      <div className="fixed inset-0 pointer-events-none">
        <Image
          src="/images/fond-connexion.jpg"
          alt={t("connexion.illustrationAlt")}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Voile bleu nuit préservant le contraste tout en laissant transparaître la photo */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-primaire/35 via-primaire/15 to-primaire/75"
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between px-3.5 py-3.5 sm:px-8 sm:py-5">
        {/* Boutons de navigation flottants en haut de page, identiques à la connexion */}
        <header className="flex items-center justify-between gap-3">
          <RetourAccueil langue={langue} />
          <SelecteurLangue className="rounded-pill bg-surface/95 px-4 py-1.5 shadow-[0_8px_24px_-12px_rgb(2_20_38/0.45)] backdrop-blur-sm" />
        </header>

        {/* Carte centrale ivoire / blanc cassé translucide */}
        <div className="flex flex-1 items-center justify-center py-4 sm:py-6">
          <section className="w-full max-w-[490px] sm:max-w-[510px] rounded-[22px] sm:rounded-[26px] bg-surface/88 p-4 sm:p-6 shadow-[0_28px_70px_-24px_rgb(2_20_38/0.55)] backdrop-blur-xl">
            {/* 1. Logo Teranga Way centré en haut de la carte */}
            <Lien
              href="/"
              className="mx-auto block w-[165px] sm:w-[185px] transition-opacity hover:opacity-90"
              aria-label={t("commun.nomApplication")}
            >
              <Image
                src="/images/logo-complet.png"
                alt="Teranga Way"
                width={775}
                height={205}
                priority
                className="h-auto w-full"
              />
            </Lien>

            {/* 2 & 3. Badge discret + Récapitulatif compact de l'offre */}
            {logement ? (
              <Lien
                href={`/logements/${logement.slug}`}
                title={logement.titre}
                className="group mt-3.5 flex items-center gap-2.5 rounded-[14px] border border-contour-champ/60 bg-champ/50 p-2 sm:p-2.5 transition-colors hover:bg-champ/75"
              >
                <span className="relative h-11 w-12 sm:h-12 sm:w-14 shrink-0 overflow-hidden rounded-[9px] bg-champ">
                  <Image
                    src={logement.photos[0].url}
                    alt={logement.photos[0].alt}
                    fill
                    sizes="56px"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-pill bg-teinte-jaune px-2 py-0.5 text-[10.5px] font-semibold text-alerte">
                      <Home className="h-3 w-3 text-jaune-fonce" />
                      Logement
                    </span>
                    <span className="truncate text-[11.5px] text-encre-douce">
                      {logement.quartier}, {logement.ville}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] sm:text-[13.5px] font-bold text-encre group-hover:text-primaire">
                    {logement.titre}
                  </p>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <p className="text-[13px] sm:text-[14px] font-bold text-primaire chiffres-tabulaires">
                    {formaterPrix(logement.prixParNuit, langue)}
                  </p>
                  <p className="text-[10px] text-encre-douce">
                    {t("commun.parNuit")}
                  </p>
                </div>
              </Lien>
            ) : vehicule ? (
              <Lien
                href={`/transports/${vehicule.slug}`}
                title={`${vehicule.marque} ${vehicule.modele}`}
                className="group mt-3.5 flex items-center gap-2.5 rounded-[14px] border border-contour-champ/60 bg-champ/50 p-2 sm:p-2.5 transition-colors hover:bg-champ/75"
              >
                <span className="relative h-11 w-12 sm:h-12 sm:w-14 shrink-0 overflow-hidden rounded-[9px] bg-champ">
                  <Image
                    src={vehicule.photos[0].url}
                    alt={vehicule.photos[0].alt}
                    fill
                    sizes="56px"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-pill bg-teinte-jaune px-2 py-0.5 text-[10.5px] font-semibold text-alerte">
                      <Car className="h-3 w-3 text-jaune-fonce" />
                      {t(`categorieVehicule.${vehicule.categorie}`) || "Véhicule"}
                    </span>
                    <span className="truncate text-[11.5px] text-encre-douce">
                      {vehicule.placesPassagers} {t("demandeTransport.passagers")}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] sm:text-[13.5px] font-bold text-encre group-hover:text-primaire">
                    {vehicule.marque} {vehicule.modele}
                  </p>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <p className="text-[13px] sm:text-[14px] font-bold text-primaire chiffres-tabulaires">
                    {formaterPrix(prixVehicule, langue)}
                  </p>
                </div>
              </Lien>
            ) : null}

            {/* 4. Titre centré « Faire une demande » */}
            <h1 className="mt-3.5 text-center text-[20px] sm:text-[23px] font-bold tracking-[-0.02em] text-encre">
              {logement ? t("demande.titreEtape1") : t("demandeTransport.titre")}
            </h1>

            {/* 5, 6, 7. Formulaire, indicateur et bouton principal */}
            <div className="mt-3.5">
              {logement ? (
                <FormulaireDemande
                  logement={logement}
                  debut={recherche.debut ?? SEJOUR_DEFAUT.debut}
                  fin={recherche.fin ?? SEJOUR_DEFAUT.fin}
                  personnes={Number(recherche.personnes ?? 2)}
                  etatSimule={(recherche.etat as EtatEnvoi) ?? "normal"}
                  visiteur={visiteurProp}
                  brouillon={await lireBrouillonLogement(logement.id)}
                />
              ) : vehicule ? (
                <FormulaireTransport
                  vehicule={vehicule}
                  prestation={prestation}
                  depart={recherche.depart ?? recherche.lieu ?? ""}
                  arrivee={recherche.arrivee ?? recherche.destination ?? ""}
                  quand={recherche.quand ?? `${SEJOUR_DEFAUT.debut}T10:00`}
                  passagers={Number(recherche.passagers ?? recherche.personnes ?? 2)}
                  etatSimule={(recherche.etat as EtatEnvoi) ?? "normal"}
                  visiteur={visiteurProp}
                  brouillon={await lireBrouillonTransport(vehicule.id)}
                />
              ) : null}
            </div>
          </section>
        </div>

        {/* Signature Dakar en bas de page */}
        <div className="flex items-center justify-end pb-2 pt-2 text-white/80">
          <div className="flex flex-col items-center">
            <Image
              src="/images/signature-dakar.png"
              alt="Dakar"
              width={420}
              height={168}
              className="h-auto w-[110px] sm:w-[130px]"
            />
            <span className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.38em] text-white/85">
              {t("connexion.vousAttend")}
            </span>
            <span className="mt-1.5 block h-[2.5px] w-[50px] rounded-pill bg-jaune-vif" />
          </div>
        </div>
      </div>
    </main>
  );
}
