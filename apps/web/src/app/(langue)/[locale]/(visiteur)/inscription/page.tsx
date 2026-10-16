import { redirect } from "next/navigation";
import { Carte } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { FormulaireInscription } from "@/features/compte/formulaire-inscription";
import { visiteurConnecte } from "@/features/compte/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Inscription — première étape du parcours de compte.
 *
 * Distincte de `/connexion`, et volontairement : l'une crée un compte, l'autre
 * ouvre une session sur un compte existant. Les confondre, c'est le défaut que
 * ce parcours corrige — la page de connexion demandait une adresse et un code,
 * sans qu'aucune inscription n'ait eu lieu.
 *
 * Aucune session n'est ouverte ici. Le formulaire mène à
 * `/inscription/verification`, et le compte n'existe vraiment qu'après.
 */
export default async function Inscription({
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

  // Déjà connecté : s'inscrire n'a plus de sens, on va là où la personne allait.
  const visiteur = await visiteurConnecte();
  if (visiteur) {
    const cible = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/compte";
    redirect(cible.startsWith(`/${langue}`) ? cible : `/${langue}${cible}`);
  }

  return (
    <main className="bg-page pb-16">
      <EnTete />

      <div className="mx-auto w-[87.5%] max-w-[480px] pt-10">
        <h1 className="text-titre-1 text-encre">{t("inscription.titre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">{t("inscription.texte")}</p>

        <Carte className="mt-6 p-5">
          <FormulaireInscription suite={suite} />
        </Carte>

        <p className="mt-6 text-center text-petit text-encre-douce">
          {t("inscription.dejaUnCompte")}{" "}
          <Lien
            href={`/connexion${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
            className="font-semibold text-primaire underline underline-offset-2"
          >
            {t("inscription.seConnecter")}
          </Lien>
        </p>
      </div>
    </main>
  );
}
