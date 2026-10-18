import Image from "next/image";
import { Bandeau, Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { FormulaireDemandeService } from "@/features/services/formulaire-demande-service";
import {
  CONSEILS_INTERNET,
  ETAPES_SIM,
  OPERATEURS,
  OPTIONS_SANS_SIM,
  ZONES_COUVERTURE,
} from "@/features/services/internet";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Carte SIM & internet — la page du service.
 *
 * Elle explique un système que personne ne connaît en arrivant : tout est
 * prépayé, on achète des « pass » et non un abonnement, et aucune puce ne
 * s'active sans pièce d'identité. Le formulaire ne vient qu'après : on ne sait
 * pas quoi demander tant qu'on ne sait pas comment ça marche.
 *
 * Aucun tarif n'est écrit en dur, seulement des ordres de grandeur. Les prix
 * des pass changent plusieurs fois par an, et une page qui les fige envoie le
 * visiteur réclamer en boutique un forfait qui n'existe plus.
 */
const ICONES_OPTION: Record<(typeof OPTIONS_SANS_SIM)[number], NomIcone> = {
  esim: "telephone",
  roaming: "avion",
  wifiLogement: "wifi",
  boxPortable: "valise",
};

const ICONES_CONSEIL: Record<(typeof CONSEILS_INTERNET)[number], NomIcone> = {
  telephoneDebloque: "telephone",
  doubleSim: "double-coche",
  wave: "prix",
  whatsapp: "whatsapp",
};

const FAQ = ["1", "2", "3", "4", "5"] as const;

export default async function Internet({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ operateur?: string }>;
}) {
  const { locale } = await params;
  const { operateur } = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const choisi = OPERATEURS.find((candidat) => candidat.cle === operateur);
  const messageInitial = choisi
    ? t("internet.messagePour", { operateur: choisi.nom })
    : "";

  return (
    <main className="bg-page pb-16">
      {/* hero */}
      <section className="relative overflow-hidden bg-primaire">
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            background:
              "radial-gradient(900px 420px at 78% 12%, rgba(247,181,0,0.85) 0%, rgba(247,181,0,0) 62%), radial-gradient(800px 480px at 8% 92%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%)",
          }}
        />

        {/* La photo tient dans un panneau de 320 px : c'est la taille de
            la source. Étirée en bandeau comme les autres heros, elle
            serait floue. */}
        <div className="relative mx-auto grid w-[92%] max-w-[1260px] items-center gap-8 py-14 md:py-16 lg:grid-cols-[1fr_320px]">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-petit text-white/70">
              <Lien href="/services" className="hover:text-white">
                {t("services.nosServices")}
              </Lien>
              <Icone nom="chevron-droite" taille={16} />
              <span className="text-white">{t("internet.surtitre")}</span>
            </nav>

            <h1 className="mt-3 max-w-[22ch] text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("internet.titre")}
            </h1>
            <p className="mt-4 max-w-[58ch] text-corps leading-relaxed text-white/90">
              {t("internet.chapeau")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demande">
                <Bouton variante="secondaire" largeur="contenu">
                  <span className="inline-flex items-center gap-2">
                    {t("internet.actionDemander")}
                    <Icone nom="chevron-droite" taille={16} />
                  </span>
                </Bouton>
              </a>
              <a
                href="#bases"
                className="inline-flex min-h-[var(--size-touch)] items-center rounded-control border border-white/40 px-5 text-petit font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("internet.actionComprendre")}
              </a>
            </div>
          </div>

          <div className="relative aspect-[195/230] w-[200px] overflow-hidden rounded-card border border-white/20 shadow-[0_24px_60px_-20px_rgb(2_20_38/0.55)] sm:w-[260px] lg:w-[320px] lg:justify-self-end">
            <Image
              src="/images/services/sim-insertion.jpg"
              alt={t("internet.heroAlt")}
              fill
              priority
              sizes="(max-width: 640px) 200px, (max-width: 1024px) 260px, 320px"
              quality={92}
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* le principe du prépayé */}
      <section id="bases" className="mx-auto w-[92%] max-w-[1260px] pt-12 scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.basesSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.basesTitre")}</h2>
        <p className="mt-3 max-w-[75ch] text-corps leading-relaxed text-encre-douce">
          {t("internet.basesTexte")}
        </p>
        <div className="mt-5 max-w-[75ch]">
          <Bandeau variante="information">{t("internet.baseWhatsapp")}</Bandeau>
        </div>
      </section>

      {/* les opérateurs */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.operateursSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.operateursTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("internet.operateursTexte")}
        </p>

        <ul className="mt-8 grid gap-4 lg:grid-cols-3">
          {OPERATEURS.map((operateurListe) => (
            <li key={operateurListe.cle}>
              <Carte className="flex h-full flex-col p-6">
                <h3 className="text-titre-2 text-encre">{operateurListe.nom}</h3>
                <p className="mt-3 flex-1 text-petit leading-relaxed text-encre-douce">
                  {t(`internet.operateur.${operateurListe.cle}Texte`)}
                </p>
                <p className="mt-4 rounded-card bg-teinte-bleu px-4 py-3 text-legende font-semibold text-primaire">
                  {t(`internet.operateur.${operateurListe.cle}Conseil`)}
                </p>
                <Lien
                  href={`/services/internet?operateur=${operateurListe.cle}#demande`}
                  className="mt-4 inline-flex items-center gap-1 text-legende font-semibold text-primaire hover:underline"
                >
                  {t("internet.operateurDemander")}
                  <Icone nom="chevron-droite" taille={16} />
                </Lien>
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {/* obtenir une puce */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.simSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.simTitre")}</h2>

        <ol className="mt-8 space-y-3">
          {ETAPES_SIM.map((etape, index) => (
            <li key={etape}>
              <Carte className="flex gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primaire text-petit font-bold text-white chiffres-tabulaires">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-petit font-semibold text-encre">
                    {t(`internet.etape.${etape}Titre`)}
                  </span>
                  <span className="mt-1 block max-w-[80ch] text-legende leading-relaxed text-encre-douce">
                    {t(`internet.etape.${etape}Texte`)}
                  </span>
                </span>
              </Carte>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-card border border-contour bg-surface p-5">
          <h3 className="flex items-center gap-2 text-petit font-semibold text-encre">
            <Icone nom="prix" taille={16} />
            {t("internet.simPrixTitre")}
          </h3>
          <p className="mt-2 max-w-[80ch] text-legende leading-relaxed text-encre-douce">
            {t("internet.simPrixTexte")}
          </p>
        </div>
      </section>

      {/* la couverture réelle */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.couvertureSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.couvertureTitre")}</h2>

        <ul className="mt-6 grid gap-px overflow-hidden rounded-card border border-contour bg-contour sm:grid-cols-3">
          {ZONES_COUVERTURE.map((zone) => (
            <li key={zone} className="bg-surface px-5 py-5">
              <span className="block text-petit font-semibold text-encre">
                {t(`internet.couverture.${zone}Titre`)}
              </span>
              <span className="mt-2 block text-legende leading-relaxed text-encre-douce">
                {t(`internet.couverture.${zone}Texte`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* se connecter sans boutique */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.sansSimSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.sansSimTitre")}</h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OPTIONS_SANS_SIM.map((option) => (
            <li key={option}>
              <Carte className="h-full p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={ICONES_OPTION[option]} taille={20} />
                </span>
                <h3 className="mt-4 text-petit font-semibold text-encre">
                  {t(`internet.option.${option}Titre`)}
                </h3>
                <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                  {t(`internet.option.${option}Texte`)}
                </p>
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {/* à régler avant de partir */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.conseilsSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.conseilsTitre")}</h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {CONSEILS_INTERNET.map((conseil) => (
            <li key={conseil}>
              <Carte className="flex h-full gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={ICONES_CONSEIL[conseil]} taille={20} />
                </span>
                <span>
                  <span className="block text-petit font-semibold text-encre">
                    {t(`internet.conseil.${conseil}Titre`)}
                  </span>
                  <span className="mt-1 block text-legende leading-relaxed text-encre-douce">
                    {t(`internet.conseil.${conseil}Texte`)}
                  </span>
                </span>
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {/* la demande */}
      <section id="demande" className="mx-auto mt-14 w-[92%] max-w-[680px] scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("internet.demandeSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("internet.demandeTitre")}</h2>
        <p className="mt-3 text-corps leading-relaxed text-encre-douce">
          {t("internet.demandeTexte")}
        </p>

        <div className="mt-7">
          <FormulaireDemandeService service="internet" messageInitial={messageInitial} />
        </div>
      </section>

      {/* questions fréquentes */}
      <section className="mx-auto mt-14 w-[92%] max-w-[860px]">
        <h2 className="text-titre-1 text-encre">{t("internet.faqTitre")}</h2>
        <dl className="mt-6 divide-y divide-contour overflow-hidden rounded-card border border-contour bg-surface">
          {FAQ.map((numero) => (
            <div key={numero} className="p-5">
              <dt className="text-petit font-semibold text-encre">
                {t(`internet.faqQ${numero}`)}
              </dt>
              <dd className="mt-2 text-petit leading-relaxed text-encre-douce">
                {t(`internet.faqR${numero}`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
