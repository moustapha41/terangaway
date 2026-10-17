import { notFound } from "next/navigation";
import type { Vehicule } from "@teranga/contracts";
import { BadgeVerifie, Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { formaterDateComplete, formaterHeure } from "@/lib/dates";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { OngletsVehicule } from "@/features/transport/onglets-vehicule";
import { GalerieLogement } from "@/components/visiteur/galerie-logement";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { formaterPrix } from "@/lib/prix";
import { obtenirVehicule } from "@/mocks/api";

/**
 * Fiche véhicule — la même pour le trajet et pour la location (§B.3), seul le
 * prix change d'unité. Deux fiches distinctes auraient divergé au premier
 * changement.
 */
export default async function FicheVehicule({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale, slug } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const recherche = await searchParams;
  const besoin = recherche.besoin;
  const t = traducteurPour(langue);

  const vehicule = await obtenirVehicule(slug);
  if (!vehicule) notFound();

  const pourLocation = besoin === "location";

  // Le contexte de recherche suit jusqu'à la demande : le visiteur a déjà saisi
  // son trajet et ses dates, il n'a pas à les retaper.
  const contexte = new URLSearchParams();
  contexte.set("prestation", pourLocation ? "journee" : besoin === "taxi" ? "taxi" : "trajet");
  for (const [de, vers] of [
    ["depart", "depart"], ["lieu", "depart"],
    ["arrivee", "arrivee"], ["destination", "arrivee"],
    ["quand", "quand"], ["passagers", "passagers"],
  ] as const) {
    const valeur = recherche[de];
    if (valeur && !contexte.has(vers)) contexte.set(vers, valeur);
  }
  const prix = pourLocation ? vehicule.prixParJour : vehicule.prixParTrajet;
  const unite = pourLocation ? t("transport.parJour") : t("transport.parTrajet");

  return (
    <main className="bg-page pb-16">
      <EnTeteSession />

      <div className="mx-auto w-[92%] max-w-[1000px] pt-6 sm:w-[87.5%]">
        <nav className="flex flex-wrap items-center gap-2 text-petit text-encre-douce">
          <Lien href="/" className="hover:text-primaire">
            {t("navigation.accueil")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <Lien href="/transports" className="hover:text-primaire">
            {t("entete.transports")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <span className="text-encre">
            {vehicule.marque} {vehicule.modele}
          </span>
        </nav>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-8">
            <GalerieLogement photos={vehicule.photos} />

            <header>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-legende uppercase tracking-wider text-encre-douce">
                  {t(`categorieVehicule.${vehicule.categorie}`)}
                </span>
                <BadgeVerifie libelle={t("commun.verifie")} />
              </div>
              <h1 className="mt-2 text-titre-1 text-encre">
                {vehicule.marque} {vehicule.modele} · {vehicule.annee}
              </h1>

              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-corps text-encre">
                <Trait icone="personnes">{t("transport.places", { nombre: vehicule.placesPassagers })}</Trait>
                <Trait icone="bagage">{t("transport.bagagesNombre", { nombre: vehicule.bagages })}</Trait>
                {vehicule.climatisation && (
                  <Trait icone="climatisation">{t("transport.climatisation")}</Trait>
                )}
              </ul>
            </header>

            <OngletsVehicule vehicule={vehicule} />

            <Bandeau variante="information">{t("fiche.adresseMasquee")}</Bandeau>
          </div>

          <BarreAction
            vehicule={vehicule}
            prix={prix}
            unite={unite}
            langue={langue}
            t={t}
            contexte={contexte.toString()}
          />
        </div>
      </div>
    </main>
  );
}

function BarreAction({
  vehicule,
  prix,
  unite,
  langue,
  contexte,
  t,
}: {
  vehicule: Vehicule;
  prix?: number;
  unite: string;
  langue: Langue;
  /** Trajet et dates déjà saisis, transmis à la demande. */
  contexte: string;
  t: Traducteur;
}) {
  const saisi = new URLSearchParams(contexte);

  return (
    <Carte className="min-w-0 p-4 sm:p-6 lg:sticky lg:top-6">
      {prix !== undefined && (
        <p className="text-prix text-encre chiffres-tabulaires">
          {formaterPrix(prix, langue)}
          <span className="ml-1 text-petit font-normal text-encre-douce">{unite}</span>
        </p>
      )}

      {/* Ce que le visiteur a déjà saisi, relu avant de demander. Un champ vide
          se dit, il ne se cache pas : « À renseigner ». */}
      <dl className="mt-4 divide-y divide-contour border-y border-contour">
        <LigneTrajet terme={t("ficheVehicule.depart")} valeur={saisi.get("depart")} t={t} />
        <LigneTrajet terme={t("ficheVehicule.arrivee")} valeur={saisi.get("arrivee")} t={t} />
        <LigneTrajet
          terme={t("ficheVehicule.quand")}
          // La date se lit dans la langue du visiteur, pas en ISO.
          valeur={(() => {
            const brut = saisi.get("quand");
            if (!brut) return null;
            const d = new Date(brut);
            return Number.isNaN(d.getTime())
              ? brut
              : `${formaterDateComplete(d, langue)} · ${formaterHeure(d, langue)}`;
          })()}
          t={t}
        />
        <LigneTrajet terme={t("ficheVehicule.voyageurs")} valeur={saisi.get("passagers")} t={t} />
      </dl>

      <div className="mt-4">
        <Lien href={`/demande/${vehicule.id}?${contexte}`}>
          <Bouton variante="principal" largeur="pleine">
            {t("transport.demanderVehicule")}
          </Bouton>
        </Lien>
      </div>

      <p className="mt-3 text-legende text-encre-douce">{t("resultats.paiementSurPlace")}</p>

      <div className="mt-4 rounded-control bg-teinte-bleu p-4">
        <p className="flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="horloge" taille={20} />
          {t("ficheVehicule.confirmationRapide")}
        </p>
        <p className="mt-1 text-legende text-encre-douce">
          {t("ficheVehicule.confirmationRapideTexte")}
        </p>
      </div>
    </Carte>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-contour pt-6">
      <h2 className="mb-3 text-titre-2 text-encre">{titre}</h2>
      {children}
    </section>
  );
}

function Trait({ icone, children }: { icone: "personnes" | "bagage" | "climatisation"; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icone nom={icone} taille={20} className="shrink-0 text-encre-douce" />
      {children}
    </li>
  );
}

function Inclus({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icone nom="coche-cercle" taille={20} className="shrink-0 text-succes" />
      {children}
    </li>
  );
}

function LigneTrajet({
  terme,
  valeur,
  t,
}: {
  terme: string;
  valeur?: string | null;
  t: Traducteur;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 py-2.5 sm:gap-3">
      <dt className="shrink-0 text-legende text-encre-douce">{terme}</dt>
      <dd className={"break-words text-right text-petit " + (valeur ? "text-encre" : "text-encre-douce")}>
        {valeur || t("ficheVehicule.aRenseigner")}
      </dd>
    </div>
  );
}
