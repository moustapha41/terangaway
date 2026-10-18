import Image from "next/image";
import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import {
  DELAIS_ASSISTANCE,
  DOMAINES_ASSISTANCE,
  ETAPES_ASSISTANCE,
} from "@/features/services/assistance";
import { FormulaireDemandeService } from "@/features/services/formulaire-demande-service";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Assistance — la page du service.
 *
 * Le formulaire générique proposait cinq cases, dont « autre ». Or personne ne
 * cherche « autre » : on cherche « j'ai perdu mon passeport » ou « il me faut
 * un pédiatre ce soir ». Cette page nomme neuf situations réelles, et chacune
 * amorce le formulaire avec le besoin correspondant — ce que le visiteur a
 * cliqué n'est jamais à retaper.
 *
 * Les horaires annoncés sont ceux de l'assistance du site (7 h – 23 h) : une
 * promesse de permanence que personne ne tient à 4 h du matin ferait plus de
 * dégâts que l'absence de promesse. Pour le danger immédiat, la page renvoie
 * aux secours sénégalais avant de parler d'elle-même.
 */
const FAQ = ["1", "2", "3", "4", "5"] as const;

export default async function Assistance({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ besoin?: string }>;
}) {
  const { locale } = await params;
  const { besoin } = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const domaine = DOMAINES_ASSISTANCE.find((candidat) => candidat.cle === besoin);
  const messageInitial = domaine
    ? t("assistance.messagePour", { domaine: t(`assistance.domaine.${domaine.cle}Titre`) })
    : "";

  return (
    <main className="bg-page pb-16">
      {/* hero */}
      <section className="relative">
        {/* Le visage occupe le haut de la photo : un cadrage centré lui
            couperait le front, d'où l'ancrage en haut. */}
        <div className="relative h-[min(460px,max(340px,28vw))] w-full overflow-hidden">
          <Image
            src="/images/services/hero-assistance.jpg"
            alt={t("assistance.heroAlt")}
            fill
            priority
            sizes="100vw"
            quality={92}
            className="object-cover object-top"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.92) 0%, rgba(0,29,53,0.76) 34%, rgba(0,29,53,0.44) 60%, rgba(0,29,53,0.14) 86%, rgba(0,29,53,0) 100%)",
            }}
          />

          <div className="relative mx-auto flex h-full w-[92%] max-w-[1260px] flex-col justify-center">
            <nav className="flex flex-wrap items-center gap-2 text-petit text-white/70">
              <Lien href="/services" className="hover:text-white">
                {t("services.nosServices")}
              </Lien>
              <Icone nom="chevron-droite" taille={16} />
              <span className="text-white">{t("assistance.surtitre")}</span>
            </nav>

            <h1 className="mt-3 max-w-[22ch] text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("assistance.titre")}
            </h1>
            <p className="mt-4 max-w-[58ch] text-corps leading-relaxed text-white/90">
              {t("assistance.chapeau")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demande">
                <Bouton variante="secondaire" largeur="contenu">
                  <span className="inline-flex items-center gap-2">
                    {t("assistance.actionDemander")}
                    <Icone nom="chevron-droite" taille={16} />
                  </span>
                </Bouton>
              </a>
              <a
                href="#domaines"
                className="inline-flex min-h-[var(--size-touch)] items-center rounded-control border border-white/40 px-5 text-petit font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("assistance.actionDomaines")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ce que nous prenons en charge */}
      <section id="domaines" className="mx-auto w-[92%] max-w-[1260px] pt-12 scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("assistance.domainesSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("assistance.domainesTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("assistance.domainesTexte")}
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINES_ASSISTANCE.map((domaineListe) => (
            <li key={domaineListe.cle}>
              <Carte className="flex h-full flex-col p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={domaineListe.icone} taille={20} />
                </span>
                <h3 className="mt-4 text-petit font-semibold text-encre">
                  {t(`assistance.domaine.${domaineListe.cle}Titre`)}
                </h3>
                <p className="mt-2 flex-1 text-legende leading-relaxed text-encre-douce">
                  {t(`assistance.domaine.${domaineListe.cle}Texte`)}
                </p>
                <Lien
                  href={`/services/assistance?besoin=${domaineListe.cle}#demande`}
                  className="mt-4 inline-flex items-center gap-1 text-legende font-semibold text-primaire hover:underline"
                >
                  {t("assistance.actionDemander")}
                  <Icone nom="chevron-droite" taille={16} />
                </Lien>
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {/* comment ça marche */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("assistance.marcheSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("assistance.marcheTitre")}</h2>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES_ASSISTANCE.map((etape, index) => (
            <li key={etape}>
              <Carte className="h-full p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-primaire text-petit font-bold text-white chiffres-tabulaires">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-petit font-semibold text-encre">
                  {t(`assistance.etape.${etape}Titre`)}
                </h3>
                <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                  {t(`assistance.etape.${etape}Texte`)}
                </p>
              </Carte>
            </li>
          ))}
        </ol>
      </section>

      {/* les délais, et les secours avant nous */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("assistance.delaisSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("assistance.delaisTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("assistance.delaisTexte")}
        </p>

        <ul className="mt-6 grid gap-px overflow-hidden rounded-card border border-contour bg-contour sm:grid-cols-3">
          {DELAIS_ASSISTANCE.map((delai) => (
            <li key={delai} className="bg-surface px-5 py-5">
              <span className="block text-petit font-semibold text-encre">
                {t(`assistance.delai.${delai}Titre`)}
              </span>
              <span className="mt-1 block text-titre-2 text-primaire">
                {t(`assistance.delai.${delai}Delai`)}
              </span>
              <span className="mt-2 block text-legende leading-relaxed text-encre-douce">
                {t(`assistance.delai.${delai}Texte`)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <Bandeau variante="avertissement">
            <span className="block">{t("assistance.urgencesTexte")}</span>
            <Lien href="/aide/urgences" className="mt-1 inline-block font-semibold underline">
              {t("assistance.urgencesLien")}
            </Lien>
          </Bandeau>
        </div>
      </section>

      {/* la demande */}
      <section id="demande" className="mx-auto mt-14 w-[92%] max-w-[680px] scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("assistance.demandeSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("assistance.demandeTitre")}</h2>
        <p className="mt-3 text-corps leading-relaxed text-encre-douce">
          {t("assistance.demandeTexte")}
        </p>

        <div className="mt-7">
          <FormulaireDemandeService
            service="assistance"
            messageInitial={messageInitial}
            valeursInitiales={domaine ? { besoin: domaine.besoin } : undefined}
          />
        </div>
      </section>

      {/* questions fréquentes */}
      <section className="mx-auto mt-14 w-[92%] max-w-[860px]">
        <h2 className="text-titre-1 text-encre">{t("assistance.faqTitre")}</h2>
        <dl className="mt-6 divide-y divide-contour overflow-hidden rounded-card border border-contour bg-surface">
          {FAQ.map((numero) => (
            <div key={numero} className="p-5">
              <dt className="text-petit font-semibold text-encre">
                {t(`assistance.faqQ${numero}`)}
              </dt>
              <dd className="mt-2 text-petit leading-relaxed text-encre-douce">
                {t(`assistance.faqR${numero}`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
