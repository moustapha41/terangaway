import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Car, Home, MapPin } from "lucide-react";
import { RetourAccueil } from "@/components/layout/retour-accueil";
import { SelecteurLangue } from "@/components/layout/selecteur-langue";
import { Logo } from "@/components/layout/logo";
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
 * Écran 4 · Demande — refonte plein cadre d'après l'identité visuelle de connexion.
 *
 * 1. Barre supérieure : Logo Teranga Way, retour accueil, sélecteur de langue.
 * 2. Arrière-plan illustré avec voile discret bleu marine.
 * 3. Carte centrale blanche/blanc cassé aux coins arrondis et ombre subtile.
 * 4. En-tête indiquant le logement concerné et le titre « Faire une demande ».
 * 5. Indicateur en 3 étapes (Informations, Détails, Confirmation).
 * 6. Formulaire organisé avec validation, session et flux OTP préservés.
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
      {/* 2. Arrière-plan illustré inspiré de la page de connexion */}
      <Image
        src="/images/fond-connexion.jpg"
        alt={t("connexion.illustrationAlt")}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Voile discret pour garantir la lisibilité (légèrement plus soutenu sur mobile) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-primaire/65 via-primaire/40 to-primaire/85 sm:from-primaire/45 sm:via-primaire/25 sm:to-primaire/80"
      />

      <div className="relative flex min-h-screen flex-col px-3.5 py-3 sm:px-8 sm:py-5">
        {/* 1. Barre supérieure : Logo Teranga Way, Bouton « Retour à l'accueil », Sélecteur de langue */}
        <header className="flex items-center justify-between gap-3">
          <Lien
            href="/"
            className="flex shrink-0 items-center transition-opacity hover:opacity-90"
            aria-label={t("commun.nomApplication")}
          >
            <Logo hauteur={38} forme="complet" variante="clair" prioritaire className="hidden sm:block" />
            <Logo hauteur={32} forme="verrou" variante="clair" prioritaire className="sm:hidden" />
          </Lien>

          <div className="flex items-center gap-2 sm:gap-3">
            <RetourAccueil
              langue={langue}
              className="text-[12.5px] sm:text-[14px] px-3 sm:px-4 py-1.5"
            />
            <SelecteurLangue className="rounded-pill bg-surface/95 px-3 sm:px-4 py-1.5 shadow-[0_8px_24px_-12px_rgb(2_20_38/0.45)] backdrop-blur-sm" />
          </div>
        </header>

        {/* 3. Carte centrale blanche / blanc cassé avec coins arrondis et ombre douce */}
        <div className="flex flex-1 items-center justify-center py-5 sm:py-9">
          <section className="w-full max-w-[660px] rounded-[22px] sm:rounded-[28px] bg-surface/96 p-4 sm:p-8 shadow-[0_28px_70px_-24px_rgb(2_20_38/0.55)] backdrop-blur-xl">
            {/* 4. En-tête indiquant le logement (ou véhicule) concerné et le titre « Faire une demande » */}
            <div className="mb-6 border-b border-contour/70 pb-5">
              {logement ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-teinte-jaune px-3 py-1 text-[12px] font-semibold text-alerte">
                      <Home className="h-3.5 w-3.5 text-jaune-fonce" />
                      Logement
                    </span>

                    <Lien
                      href={`/logements/${logement.slug}`}
                      className="inline-flex items-center gap-1.5 text-[12.5px] sm:text-[13px] font-semibold text-primaire hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("demande.retour")}
                    </Lien>
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-contour-champ/30 bg-champ/50 p-2.5 sm:p-3">
                    <span className="relative h-14 w-16 sm:h-16 sm:w-20 shrink-0 overflow-hidden rounded-[10px] bg-champ">
                      <Image
                        src={logement.photos[0].url}
                        alt={logement.photos[0].alt}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[14.5px] sm:text-[16px] font-bold text-encre">
                        {logement.titre}
                      </h2>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] sm:text-[13px] text-encre-douce">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-jaune-fonce" />
                        <span>{logement.quartier}, {logement.ville}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14.5px] sm:text-[16px] font-bold text-primaire chiffres-tabulaires">
                        {formaterPrix(logement.prixParNuit, langue)}
                      </p>
                      <p className="text-[11px] text-encre-douce">
                        {t("commun.parNuit")}
                      </p>
                    </div>
                  </div>

                  <h1 className="mt-5 text-center text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-encre">
                    {t("demande.titreEtape1")}
                  </h1>
                </>
              ) : vehicule ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-teinte-jaune px-3 py-1 text-[12px] font-semibold text-alerte">
                      <Car className="h-3.5 w-3.5 text-jaune-fonce" />
                      {t(`categorieVehicule.${vehicule.categorie}`) || "Véhicule"}
                    </span>

                    <Lien
                      href={`/transports/${vehicule.slug}`}
                      className="inline-flex items-center gap-1.5 text-[12.5px] sm:text-[13px] font-semibold text-primaire hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("demande.retour")}
                    </Lien>
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-contour-champ/30 bg-champ/50 p-2.5 sm:p-3">
                    <span className="relative h-14 w-16 sm:h-16 sm:w-20 shrink-0 overflow-hidden rounded-[10px] bg-champ">
                      <Image
                        src={vehicule.photos[0].url}
                        alt={vehicule.photos[0].alt}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[14.5px] sm:text-[16px] font-bold text-encre">
                        {vehicule.marque} {vehicule.modele}
                      </h2>
                      <p className="mt-0.5 truncate text-[12px] sm:text-[13px] text-encre-douce">
                        {t(`categorieVehicule.${vehicule.categorie}`)} · {vehicule.placesPassagers} {t("demandeTransport.passagers")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14.5px] sm:text-[16px] font-bold text-primaire chiffres-tabulaires">
                        {formaterPrix(prixVehicule, langue)}
                      </p>
                    </div>
                  </div>

                  <h1 className="mt-5 text-center text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-encre">
                    {t("demandeTransport.titre")}
                  </h1>
                </>
              ) : null}
            </div>

            {/* Formulaire */}
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
          </section>
        </div>

        {/* Signature Dakar comme sur la page de connexion */}
        <div className="flex items-center justify-end pb-3 pt-2 text-white/80">
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
