import Image from "next/image";
import { Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { FormulaireDemandeService } from "@/features/services/formulaire-demande-service";
import { GalerieTresors } from "@/features/services/galerie-tresors";
import { PRESTATIONS_GUIDE, TRESORS } from "@/features/services/tresors";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Guide & Découverte — la page du service, et non le formulaire nu.
 *
 * Les autres services à la demande partagent `/services/[service]` : quelques
 * champs suffisent à dire ce qu'on veut. Celui-ci ne s'y prêtait pas. On ne
 * demande pas un guide comme une carte SIM : il faut d'abord savoir ce qu'il y
 * a à voir, et ce qu'un accompagnateur apporte qu'un plan ne donne pas. Cette
 * page statique l'emporte sur la route dynamique — c'est la règle de Next —
 * et le formulaire reste le même, en bas, une fois le visiteur renseigné.
 *
 * `site` dans l'adresse amorce le message : la galerie y envoie le visiteur
 * depuis la fiche qu'il regardait, et le lien reste partageable.
 */
const ATOUTS: { cle: string; icone: NomIcone }[] = [
  { cle: "langues", icone: "globe" },
  { cle: "equipe", icone: "verification" },
  { cle: "prix", icone: "prix" },
];

const ICONES_PRESTATION: Record<(typeof PRESTATIONS_GUIDE)[number], NomIcone> = {
  accompagnement: "guide",
  interpretariat: "enveloppe",
  visiteGuidee: "visite",
  surMesure: "calendrier",
};

const FAQ = ["1", "2", "3", "4", "5"] as const;

export default async function GuideDecouverte({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ site?: string }>;
}) {
  const { locale } = await params;
  const { site } = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  // Un paramètre arrive de l'extérieur : on ne s'en sert que s'il désigne un
  // site connu, sinon n'importe quel texte entrerait dans le formulaire.
  const tresor = TRESORS.find((candidat) => candidat.cle === site);
  const messageInitial = tresor
    ? t("guides.messagePour", { site: t(`guides.tresor.${tresor.cle}Nom`) })
    : "";

  return (
    <main className="bg-page pb-16">
      {/* hero */}
      <section className="relative">
        <div className="relative h-[min(460px,max(340px,28vw))] w-full overflow-hidden">
          <Image
            src="/images/services/hero-guide.jpg"
            alt={t("guides.heroAlt")}
            fill
            priority
            sizes="100vw"
            quality={92}
            className="object-cover object-[65%_40%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.9) 0%, rgba(0,29,53,0.72) 34%, rgba(0,29,53,0.38) 60%, rgba(0,29,53,0.1) 86%, rgba(0,29,53,0) 100%)",
            }}
          />

          <div className="relative mx-auto flex h-full w-[92%] max-w-[1260px] flex-col justify-center">
            <nav className="flex flex-wrap items-center gap-2 text-petit text-white/70">
              <Lien href="/services" className="hover:text-white">
                {t("services.nosServices")}
              </Lien>
              <Icone nom="chevron-droite" taille={16} />
              <span className="text-white">{t("guides.surtitre")}</span>
            </nav>

            <h1 className="mt-3 max-w-[22ch] text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("guides.titre")}
            </h1>
            <p className="mt-4 max-w-[58ch] text-corps leading-relaxed text-white/90">
              {t("guides.chapeau")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demande">
                <Bouton variante="principal" largeur="contenu">
                  <span className="inline-flex items-center gap-2">
                    {t("guides.actionDemander")}
                    <Icone nom="chevron-droite" taille={16} />
                  </span>
                </Bouton>
              </a>
              <a href="#tresors">
                <Bouton variante="secondaire" largeur="contenu">
                  {t("guides.actionExplorer")}
                </Bouton>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ce que nous organisons */}
      <section className="mx-auto w-[92%] max-w-[1260px] pt-12">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("guides.prestationsSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("guides.prestationsTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("guides.prestationsTexte")}
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRESTATIONS_GUIDE.map((prestation) => (
            <li key={prestation}>
              <Carte className="h-full p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={ICONES_PRESTATION[prestation]} taille={24} />
                </span>
                <h3 className="mt-4 text-petit font-semibold text-encre">
                  {t(`guides.prestation.${prestation}Titre`)}
                </h3>
                <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                  {t(`guides.prestation.${prestation}Texte`)}
                </p>
              </Carte>
            </li>
          ))}
        </ul>

        {/* ce qui vaut pour toutes les demandes */}
        <ul className="mt-6 grid gap-px overflow-hidden rounded-card border border-contour bg-contour sm:grid-cols-3">
          {ATOUTS.map((atout) => (
            <li key={atout.cle} className="bg-surface px-5 py-4">
              <span className="flex items-center gap-2 text-petit font-semibold text-encre">
                <Icone nom={atout.icone} taille={16} />
                {t(`guides.${atout.cle}Titre`)}
              </span>
              <p className="mt-1 text-legende leading-relaxed text-encre-douce">
                {t(`guides.${atout.cle}Texte`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* les trésors */}
      <section id="tresors" className="mx-auto mt-14 w-[92%] max-w-[1260px] scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("guides.tresorsSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("guides.tresorsTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("guides.tresorsTexte")}
        </p>

        <div className="mt-8">
          <GalerieTresors />
        </div>
      </section>

      {/* la demande */}
      <section id="demande" className="mx-auto mt-14 w-[92%] max-w-[680px] scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("guides.demandeSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("guides.demandeTitre")}</h2>
        <p className="mt-3 text-corps leading-relaxed text-encre-douce">
          {t("guides.demandeTexte")}
        </p>

        <div className="mt-7">
          <FormulaireDemandeService service="guides" messageInitial={messageInitial} />
        </div>
      </section>

      {/* questions fréquentes */}
      <section className="mx-auto mt-14 w-[92%] max-w-[860px]">
        <h2 className="text-titre-1 text-encre">{t("guides.faqTitre")}</h2>
        <dl className="mt-6 divide-y divide-contour overflow-hidden rounded-card border border-contour bg-surface">
          {FAQ.map((numero) => (
            <div key={numero} className="p-5">
              <dt className="text-petit font-semibold text-encre">
                {t(`guides.faqQ${numero}`)}
              </dt>
              <dd className="mt-2 text-petit leading-relaxed text-encre-douce">
                {t(`guides.faqR${numero}`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
