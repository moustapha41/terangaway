import { Bandeau, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Documents — une page qui explique pourquoi il n'y a rien à faire ici.
 *
 * Les pièces justificatives restent hors plateforme, dans un espace réservé aux
 * valideurs. Sans cette page, l'absence de téléversement passerait pour un oubli
 * ou pour une fonctionnalité manquante ; c'est une décision, et elle se dit.
 */
export default async function Documents({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <>

      <main className="max-w-[640px]">
        <Lien
          href="/prestataire/profil"
          className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
        >
          <Icone nom="retour" taille={16} />
          {t("prestataire.profilTitre")}
        </Lien>

        <h1 className="mt-4 text-titre-1 text-encre">{t("prestataire.documentsTitre")}</h1>

        <div className="mt-6">
          <Bandeau variante="information">{t("prestataire.documentsTexte")}</Bandeau>
        </div>

        <Carte className="mt-6 p-5">
          <h2 className="text-titre-3 text-encre">{t("prestataire.documentsPourquoi")}</h2>
          <p className="mt-2 text-corps text-encre-douce">{t("prestataire.documentsPourquoiTexte")}</p>
        </Carte>

        <p className="mt-6 text-corps text-encre-douce">
          {t("prestataire.documentsContact")}{" "}
          <a
            href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}
            className="font-semibold text-primaire underline underline-offset-2 chiffres-tabulaires"
          >
            {ASSISTANCE.telephone}
          </a>
        </p>
      </main>
    </>
  );
}
