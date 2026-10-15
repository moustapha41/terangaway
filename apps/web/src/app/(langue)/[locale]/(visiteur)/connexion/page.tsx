import { redirect } from "next/navigation";
import { Bandeau, Carte } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { Lien } from "@/lib/i18n/lien";
import { FormulaireConnexionVisiteur } from "@/features/compte/formulaire-connexion";
import { visiteurConnecte } from "@/features/compte/session";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { apiMockActive } from "@/lib/api/http";

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

  const visiteur = await visiteurConnecte();
  if (visiteur) {
    const cible = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/compte";
    const chemin = cible.startsWith(`/${langue}`) ? cible : `/${langue}${cible}`;
    redirect(chemin);
  }

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
          {/*
            Le code fixe n'existe que dans le mock : face à la vraie API, il est
            refusé. L'annoncer sur le site public, c'était afficher « le code est
            123456 » sous le formulaire de connexion.
          */}
          {apiMockActive() && (
            <Bandeau variante="information">
              {t("compte.codeDemo", { code: CODE_DE_DEMONSTRATION })}
            </Bandeau>
          )}
          <p className="text-center text-petit text-encre-douce">
            {t("compte.pasEncoreDeCompte")}{" "}
            <Lien
              href={`/inscription${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
              className="font-semibold text-primaire underline underline-offset-2"
            >
              {t("compte.creerUnCompte")}
            </Lien>
          </p>
          <p className="text-center text-petit text-encre-douce">{t("compte.pasDeCompte")}</p>
        </div>
      </div>
    </main>
  );
}
