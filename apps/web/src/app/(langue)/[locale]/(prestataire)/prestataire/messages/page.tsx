import { Bouton, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { ASSISTANCE } from "@/lib/assistance";

/** Messagerie : absente du MVP, dite plutôt que simulée. */
export default async function Messages({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <>

      <main className="max-w-[640px]">
        <h1 className="text-titre-1 text-encre">{t("prestataire.messages")}</h1>

        <Carte className="mt-6 px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
            <Icone nom="whatsapp" taille={28} />
          </span>
          <p className="mx-auto mt-4 max-w-[46ch] text-corps text-encre-douce">
            {t("prestataire.messagesTexte")}
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Lien href="/prestataire/demandes">
              <Bouton variante="principal" largeur="contenu">
                {t("prestataire.mesDemandes")}
              </Bouton>
            </Lien>
            <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}>
              <Bouton variante="secondaire" largeur="contenu" icone="telephone">
                {t("prestataire.aideAppeler")}
              </Bouton>
            </a>
          </div>
        </Carte>
      </main>
    </>
  );
}
