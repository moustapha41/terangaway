import { Bouton, Carte, Icone } from "@teranga/ui";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { ASSISTANCE } from "@/lib/assistance";

/** Aide aux partenaires : les délais et les engagements, au même endroit. */
export default async function Aide({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <>

      <main className="max-w-[640px]">
        <h1 className="text-titre-1 text-encre">{t("prestataire.aideTitre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">{t("prestataire.aideTexte")}</p>

        <div className="mt-6">
          <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}>
            <Bouton variante="principal" largeur="pleine" icone="telephone">
              {t("prestataire.aideAppeler")}
            </Bouton>
          </a>
        </div>

        <Carte className="mt-6 p-5">
          <h2 className="flex items-center gap-2 text-titre-3 text-encre">
            <Icone nom="horloge" taille={20} className="text-encre-douce" />
            {t("prestataire.aideDelais")}
          </h2>
          <p className="mt-2 text-corps text-encre-douce">{t("prestataire.aideDelaisTexte")}</p>
        </Carte>

        <Carte className="mt-4 p-5">
          <h2 className="flex items-center gap-2 text-titre-3 text-encre">
            <Icone nom="verification" taille={20} className="text-encre-douce" />
            {t("prestataire.aideCharte")}
          </h2>
          <p className="mt-2 text-corps text-encre-douce">{t("prestataire.aideCharteTexte")}</p>
        </Carte>
      </main>
    </>
  );
}
