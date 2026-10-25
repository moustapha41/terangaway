import Image from "next/image";
import { Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Devenir prestataire — maquette du collage prestataire, écran 1.
 *
 * Page publique : c'est la porte d'entrée des partenaires. Elle ne demande rien
 * et ne promet rien d'autre que ce que le produit fait — pas de « gagnez plus »,
 * puisque les revenus dépendent des réservations, pas de la plateforme.
 */
const AVANTAGES: { cle: string; icone: NomIcone }[] = [
  { cle: "avantageVisibilite", icone: "recherche" },
  { cle: "avantageReservations", icone: "calendrier" },
  { cle: "avantageAccompagnement", icone: "assistance" },
];

export default async function Devenir({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="mx-auto w-[92%] max-w-[1180px] py-10">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-[clamp(28px,3.4vw,42px)] font-bold leading-[1.15] tracking-[-0.02em] text-encre">
            {t("prestataire.devenirTitre")}
          </h1>
          <p className="mt-4 max-w-[48ch] text-corps leading-relaxed text-encre-douce">
            {t("prestataire.devenirTexte")}
          </p>

          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {AVANTAGES.map((avantage) => (
              <li key={avantage.cle} className="flex flex-col gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={avantage.icone} taille={20} />
                </span>
                <span className="text-petit font-semibold text-encre">
                  {t(`prestataire.${avantage.cle}`)}
                </span>
                <span className="text-legende text-encre-douce">
                  {t(`prestataire.${avantage.cle}Texte`)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Lien href="/prestataire/candidature">
              <Bouton variante="principal" largeur="pleine">
                {t("prestataire.creerCompte")}
              </Bouton>
            </Lien>
            <Lien href="/a-propos">
              <Bouton variante="secondaire" largeur="pleine">
                {t("prestataire.enSavoirPlus")}
              </Bouton>
            </Lien>
          </div>

          <p className="mt-6 text-petit text-encre-douce">
            {t("prestataire.dejaCompte")}{" "}
            <Lien
              href="/prestataire/connexion"
              className="font-semibold text-primaire underline underline-offset-2"
            >
              {t("prestataire.seConnecter")}
            </Lien>
          </p>
        </div>

        {/* Collage : un logement et un véhicule, les deux familles d'offres. */}
        <div className="relative hidden h-[400px] lg:block">
          <span className="absolute right-0 top-0 block h-[62%] w-[82%] overflow-hidden rounded-card shadow-[0_18px_40px_-12px_rgb(2_20_38/0.28)]">
            <Image
              src="/images/logement-4.png"
              alt={t("prestataire.devenirAlt")}
              fill
              priority
              sizes="40vw"
              className="object-cover"
            />
            <span className="absolute left-3 top-3 rounded-pill bg-surface/95 px-3 py-1 text-legende font-semibold text-encre">
              {t("prestataire.typeLogement")}
            </span>
          </span>

          <span className="absolute bottom-0 left-0 block h-[52%] w-[62%] overflow-hidden rounded-card border-4 border-surface shadow-[0_18px_40px_-12px_rgb(2_20_38/0.28)]">
            <Image
              src="/images/service-transport.png"
              alt=""
              fill
              sizes="30vw"
              className="object-cover"
            />
            <span className="absolute left-3 top-3 rounded-pill bg-surface/95 px-3 py-1 text-legende font-semibold text-encre">
              {t("prestataire.typeTransport")}
            </span>
          </span>
        </div>
      </div>

      <Carte className="mt-12 p-5">
        <p className="flex items-start gap-3 text-petit text-encre-douce">
          <Icone nom="verification" taille={20} className="mt-0.5 shrink-0 text-succes" />
          {t("prestataire.rappelValidation")}
        </p>
      </Carte>
    </main>
  );
}
