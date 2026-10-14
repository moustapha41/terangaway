import { Bandeau, Carte } from "@teranga/ui";
import { FormulaireConnexion } from "@/features/prestataire/formulaire-connexion";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { CODE_PRESTATAIRE } from "@/mocks/fixtures/prestataire";

/** Connexion par code à usage unique : aucun mot de passe à retenir ni à perdre. */
export default async function Connexion({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="mx-auto w-[92%] max-w-[480px] py-12">
      <h1 className="text-titre-1 text-encre">{t("prestataire.connexionTitre")}</h1>
      <p className="mt-2 text-corps text-encre-douce">{t("prestataire.connexionTexte")}</p>

      <Carte className="mt-6 p-5">
        <FormulaireConnexion />
      </Carte>

      <div className="mt-5">
        <Bandeau variante="information">
          {t("prestataire.codeDemo", { code: CODE_PRESTATAIRE })}
        </Bandeau>
      </div>

      <p className="mt-8 text-center text-petit text-encre-douce">
        {t("prestataire.pasDeCompte")}{" "}
        <Lien
          href="/prestataire/candidature"
          className="font-semibold text-primaire underline underline-offset-2"
        >
          {t("prestataire.candidater")}
        </Lien>
      </p>
    </main>
  );
}
