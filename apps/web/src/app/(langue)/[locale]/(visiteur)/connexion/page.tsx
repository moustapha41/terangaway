import { Bandeau, Carte } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { FormulaireConnexionVisiteur } from "@/features/compte/formulaire-connexion";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";

/**
 * Connexion visiteur.
 *
 * Elle n'est jamais une porte d'entrée : on n'y arrive que pour retrouver ses
 * demandes. « Le compte arrive le plus tard possible » (§B.1), et la page le
 * répète plutôt que de proposer une inscription qui n'existe pas.
 */
export default async function Connexion({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ suite?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { suite } = await searchParams;
  const t = traducteurPour(langue);

  return (
    <main className="bg-page pb-16">
      <EnTete />

      <div className="mx-auto w-[87.5%] max-w-[480px] pt-10">
        <h1 className="text-titre-1 text-encre">{t("compte.connexionTitre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">{t("compte.connexionTexte")}</p>

        <Carte className="mt-6 p-5">
          <FormulaireConnexionVisiteur suite={suite ?? "/mes-demandes"} />
        </Carte>

        <div className="mt-5 space-y-3">
          <Bandeau variante="information">
            {t("compte.codeDemo", { code: CODE_DE_DEMONSTRATION })}
          </Bandeau>
          <p className="text-center text-petit text-encre-douce">{t("compte.pasDeCompte")}</p>
        </div>
      </div>
    </main>
  );
}
