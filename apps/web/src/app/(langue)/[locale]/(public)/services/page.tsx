import Image from "next/image";
import { Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { GrilleServices } from "@/features/services/grille-services";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Page Services — maquette du dossier services.
 *
 * Elle montre les six services du produit cible, dont quatre sont reportés
 * après le MVP (§D.2). Ceux-là ouvrent une feuille « bientôt disponible »
 * plutôt que de mener à une page vide.
 */
const GARANTIES: { cle: string; icone: NomIcone }[] = [
  { cle: "garantieVerifies", icone: "verification" },
  { cle: "garantieSimple", icone: "calendrier" },
  { cle: "garantieAssistance", icone: "assistance" },
  { cle: "garantiePaiement", icone: "prix" },
];

const POINTS: { cle: string; icone: NomIcone }[] = [
  { cle: "pointQualite", icone: "verification" },
  { cle: "pointChoix", icone: "tri" },
  { cle: "pointAccompagnement", icone: "assistance" },
  { cle: "pointLocal", icone: "repere" },
];

export default async function Services({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <main className="bg-page pb-16">
      {/* hero */}
      <section className="relative">
        <div className="relative h-[min(420px,max(320px,26vw))] w-full overflow-hidden">
          <Image
            src="/images/banner-dakar.png"
            alt={t("services.heroAlt")}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_45%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.85) 0%, rgba(0,29,53,0.66) 32%, rgba(0,29,53,0.34) 58%, rgba(0,29,53,0.1) 82%, rgba(0,29,53,0) 100%)",
            }}
          />

          <div className="relative mx-auto flex h-full w-[92%] max-w-[1260px] flex-col justify-center pb-16">
            <p className="text-petit font-semibold uppercase tracking-[0.18em] text-white/80">
              {t("services.surtitre")}
            </p>
            <h1 className="mt-2 max-w-[20ch] text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("services.titre")}
            </h1>
            <p className="mt-4 max-w-[54ch] text-corps leading-relaxed text-white/90">
              {t("services.sousTitre")}
            </p>
          </div>
        </div>

        {/* bande de garanties, posée à cheval sur le hero */}
        <div className="relative z-10 mx-auto -mt-10 w-[92%] max-w-[1260px]">
          <ul className="grid gap-px overflow-hidden rounded-card border border-contour bg-contour sm:grid-cols-2 lg:grid-cols-4">
            {GARANTIES.map((garantie) => (
              <li key={garantie.cle} className="flex items-center gap-3 bg-surface px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={garantie.icone} taille={20} />
                </span>
                <span>
                  <span className="block text-petit font-semibold text-encre">
                    {t(`services.${garantie.cle}`)}
                  </span>
                  <span className="block text-legende text-encre-douce">
                    {t(`services.${garantie.cle}Texte`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* les six services */}
      <section className="mx-auto w-[92%] max-w-[1260px] pt-12">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("services.nosServices")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("services.decouvrez")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("services.decouvrezTexte")}
        </p>

        <div className="mt-8">
          <GrilleServices />
        </div>
      </section>

      {/* une expérience complète */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
          <span className="relative block aspect-[4/3] overflow-hidden rounded-card bg-champ">
            <Image
              src="/images/logement-2.png"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </span>

          <div>
            <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
              {t("services.experience")}
            </p>
            <h2 className="mt-2 text-titre-1 text-encre">{t("services.experienceTitre")}</h2>
            <p className="mt-3 max-w-[60ch] text-corps leading-relaxed text-encre-douce">
              {t("services.experienceTexte")}
            </p>

            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {POINTS.map((point) => (
                <li key={point.cle} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                    <Icone nom={point.icone} taille={20} />
                  </span>
                  <span>
                    <span className="block text-petit font-semibold text-encre">
                      {t(`services.${point.cle}`)}
                    </span>
                    <span className="block text-legende text-encre-douce">
                      {t(`services.${point.cle}Texte`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* appel à l'action */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <Carte className="relative overflow-hidden border-0">
          <Image
            src="/images/hero-sans-logo.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[center_60%]"
          />
          <div className="absolute inset-0 bg-primaire/80" />

          <div className="relative flex flex-wrap items-center justify-between gap-5 p-7">
            <div>
              <p className="text-titre-2 text-white">{t("services.pretTitre")}</p>
              <p className="mt-1 text-petit text-white/85">{t("services.pretTexte")}</p>
            </div>
            <Lien href="/logements">
              <Bouton variante="secondaire" largeur="contenu">
                <span className="inline-flex items-center gap-2">
                  {t("services.pretAction")}
                  <Icone nom="chevron-droite" taille={16} />
                </span>
              </Bouton>
            </Lien>
          </div>
        </Carte>
      </section>
    </main>
  );
}
