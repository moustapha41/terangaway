import { Inscription } from "@/features/prestataire/inscription";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Création de compte prestataire — maquette du collage, écrans 2 à 4.
 *
 * Page publique : on y arrive sans compte, c'est tout l'objet.
 */
export default async function Candidature({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="mx-auto w-[92%] max-w-[680px] py-10">
      <h1 className="text-titre-1 text-encre">{t("prestataire.inscriptionTitre")}</h1>

      <div className="mt-7">
        <Inscription />
      </div>

      <p className="mt-10 text-center text-petit text-encre-douce">
        {t("prestataire.dejaCompte")}{" "}
        <Lien
          href="/prestataire/connexion"
          className="font-semibold text-primaire underline underline-offset-2"
        >
          {t("prestataire.seConnecter")}
        </Lien>
      </p>
    </main>
  );
}
