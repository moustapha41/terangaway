import { Bandeau, Carte, Icone } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { ASSISTANCE } from "@/lib/assistance";

/**
 * Écran 16 · Numéros d'urgence.
 *
 * Volontairement sans image, sans donnée à charger et sans dépendance : c'est
 * l'écran qu'on ouvre quand tout va mal, y compris le réseau. Les numéros sont
 * écrits dans la page, pas récupérés d'une API.
 */
const NUMEROS = [
  { cle: "police", numero: "17", couleur: "bg-teinte-rouge text-danger" },
  { cle: "pompiers", numero: "18", couleur: "bg-teinte-rouge text-danger" },
  { cle: "samu", numero: "15", couleur: "bg-teinte-rouge text-danger" },
  { cle: "hopital", numero: "+221 33 839 50 50", couleur: "bg-teinte-bleu text-primaire" },
] as const;

export default async function Urgences({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="bg-page pb-16">
      <EnTete />

      <div className="mx-auto w-[87.5%] max-w-[640px] pt-6">
        <Lien href="/aide" className="inline-flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="retour" taille={16} />
          {t("aide.titre")}
        </Lien>

        <h1 className="mt-4 text-titre-1 text-encre">{t("aide.urgencesTitre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">{t("aide.urgencesIntro")}</p>

        <ul className="mt-6 space-y-3">
          {NUMEROS.map((entree) => (
            <li key={entree.cle}>
              <Carte>
                <a
                  href={`tel:${entree.numero.replace(/\s/g, "")}`}
                  className="flex items-center gap-4 p-5"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-pill ${entree.couleur}`}>
                    <Icone nom="telephone" taille={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-titre-3 text-encre">{t(`aide.${entree.cle}`)}</span>
                    <span className="mt-0.5 block text-prix text-encre chiffres-tabulaires">
                      {entree.numero}
                    </span>
                  </span>
                </a>
              </Carte>
            </li>
          ))}

          <li>
            <Carte>
              <a
                href={`tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`}
                className="flex items-center gap-4 p-5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-teinte-jaune text-primaire">
                  <Icone nom="assistance" taille={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-titre-3 text-encre">{t("aide.assistanceTeranga")}</span>
                  <span className="mt-0.5 block text-prix text-encre chiffres-tabulaires">
                    {ASSISTANCE.telephone}
                  </span>
                </span>
              </a>
            </Carte>
          </li>
        </ul>

        <div className="mt-8">
          <Bandeau variante="information">{t("aide.urgencesRappel")}</Bandeau>
        </div>
      </div>
    </main>
  );
}
