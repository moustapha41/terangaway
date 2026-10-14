import { Bouton, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Messages.
 *
 * La messagerie de la maquette est une fonctionnalité entière — fils, non-lus,
 * plusieurs interlocuteurs — absente du MVP. On le dit, et on renvoie vers les
 * deux canaux qui existent vraiment : le message joint à la demande, et le
 * téléphone de l'équipe. Un fil vide aurait été pire qu'une page honnête.
 */
export default async function Messages({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-5 text-titre-1 text-encre">{t("client.messagesTitre")}</h1>

      <Carte className="px-6 py-12 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
          <Icone nom="whatsapp" taille={28} />
        </span>
        <h2 className="mt-4 text-titre-2 text-encre">{t("client.messagesVideTitre")}</h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-corps text-encre-douce">
          {t("client.messagesVideTexte")}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Lien href="/compte/reservations">
            <Bouton variante="principal" largeur="contenu">
              {t("client.mesReservations")}
            </Bouton>
          </Lien>
          <a href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}>
            <Bouton variante="secondaire" largeur="contenu" icone="telephone">
              {t("client.nousContacter")}
            </Bouton>
          </a>
        </div>
      </Carte>
    </div>
  );
}
