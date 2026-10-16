import { Icone } from "@teranga/ui";
import { ASSISTANCE, emailUrl, telUrl } from "@/lib/assistance";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Mentions légales, rôle de la plateforme, données, cookies, marques.
 *
 * Une seule page plutôt que quatre : en V1 chacune tiendrait en un paragraphe,
 * et quatre pages d'un paragraphe donnent surtout quatre endroits où se perdre.
 * Les ancres permettent d'y renvoyer précisément.
 */
const SECTIONS = ["Editeur", "Role", "Donnees", "Cookies", "Propriete"] as const;

const ANCRES: Record<(typeof SECTIONS)[number], string> = {
  Editeur: "editeur",
  Role: "role",
  Donnees: "donnees",
  Cookies: "cookies",
  Propriete: "marques",
};

export default async function Legal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="bg-page pb-16">
      <div className="mx-auto w-[87.5%] max-w-[700px] pt-10">
        <h1 className="text-titre-1 text-encre">{t("public.legalTitre")}</h1>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section} id={ANCRES[section]} className="scroll-mt-6">
              <h2 className="mb-2 text-titre-2 text-encre">{t(`public.legal${section}`)}</h2>
              <p className="text-corps leading-relaxed text-encre-douce">
                {t(`public.legal${section}Texte`)}
              </p>
            </section>
          ))}

          <section className="border-t border-contour pt-6">
            <h2 className="mb-2 text-titre-2 text-encre">{t("public.legalContact")}</h2>
            <p className="flex items-center gap-2 text-corps text-encre">
              <Icone nom="telephone" taille={20} className="text-encre-douce" />
              <a href={telUrl} className="underline underline-offset-2 chiffres-tabulaires">
                {ASSISTANCE.telephone}
              </a>
            </p>
            <p className="mt-2 flex items-center gap-2 text-corps text-encre">
              <Icone nom="information" taille={20} className="text-encre-douce" />
              <a href={emailUrl} className="underline underline-offset-2">
                {ASSISTANCE.email}
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
