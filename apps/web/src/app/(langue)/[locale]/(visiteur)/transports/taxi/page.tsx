import { Suspense } from "react";
import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { FormulaireTaxi } from "@/features/transport/formulaire-taxi";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterPrix } from "@/lib/prix";
import { estimerTaxi, lieux } from "@/mocks/api";

/**
 * Taxi réservé.
 *
 * Deux choses le distinguent des autres transports (§B.3) : il n'y a **pas** de
 * liste de véhicules, seulement un prix indicatif ; et l'acceptation du taxi
 * vaut confirmation, donc le visiteur n'a pas d'étape 6 à franchir.
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

export default async function Taxi({
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
  const estimation = aCherche ? await estimerTaxi(Number(recherche.passagers ?? 1)) : null;

  return (
    <main className="bg-page pb-16">
      <EnTete />
      <div className="mx-auto w-[87.5%] max-w-[900px] pt-6">
        <Lien href="/transports" className="inline-flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="retour" taille={16} />
          {t("transport.titre")}
        </Lien>

        <h1 className="mb-2 mt-4 text-titre-1 text-encre">{t("transport.taxiTitre")}</h1>
        <p className="mb-6 max-w-[60ch] text-corps text-encre-douce">
          {t("transport.taxiExplication")}
        </p>

        <div className="max-w-[560px] space-y-6">
          <Suspense fallback={null}><FormulaireTaxi lieux={await suggestions()} /></Suspense>

          {estimation && (
            <Carte className="p-5">
              <p className="text-petit text-encre-douce">{t("transport.prixIndicatif")}</p>
              {/* « Environ 5 000 FCFA » : le prix du taxi n'est jamais ferme avant
                  l'acceptation du chauffeur (§C.4). */}
              <p className="mt-1 text-prix text-encre chiffres-tabulaires">
                {formaterPrix(estimation.bas, langue)} – {formaterPrix(estimation.haut, langue)}
              </p>
              <p className="mt-2 text-petit text-encre-douce">
                {t("transport.prixIndicatifTexte")}
              </p>

              <div className="mt-5">
                <Bandeau variante="information">{t("resultats.paiementSurPlace")}</Bandeau>
              </div>

              <div className="mt-5">
                <Lien href="/mes-demandes">
                  <Bouton variante="principal" largeur="pleine">
                    {t("transport.demanderTaxi")}
                  </Bouton>
                </Lien>
              </div>
            </Carte>
          )}
        </div>
      </div>
    </main>
  );
}
