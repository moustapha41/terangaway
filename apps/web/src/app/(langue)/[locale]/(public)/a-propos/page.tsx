import Image from "next/image";
import { Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { CarteDakar } from "@/features/a-propos/carte-dakar";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, LANGUES, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * À propos — maquette du dossier a_propos.
 *
 * La bande « en chiffres » annonce la **capacité du réseau** — ce que l'équipe
 * peut mobiliser auprès de ses partenaires —, et non le nombre de fiches en
 * ligne, qui est plus petit tant que le catalogue se remplit. Ces nombres ne
 * sont donc plus calculés : ils se tiennent à la main, ici, et il faut les
 * revoir quand le réseau change. Une seule exception, les langues, qui se
 * comptent toutes seules puisque le site les sert vraiment.
 */
const CHIFFRES: { valeur: string; cle: string; icone: NomIcone }[] = [
  { valeur: "300+", cle: "chiffreLogements", icone: "logement" },
  { valeur: "100+", cle: "chiffreVehicules", icone: "voiture" },
  { valeur: "10+", cle: "chiffrePrestataires", icone: "personnes" },
];

const VALEURS: { cle: string; icone: NomIcone }[] = [
  { cle: "valeurConfiance", icone: "verification" },
  { cle: "valeurInclusion", icone: "personnes" },
  { cle: "valeurQualite", icone: "etoile" },
  { cle: "valeurImpact", icone: "repere" },
];

const GARANTIES: { cle: string; icone: NomIcone }[] = [
  { cle: "garantieVerifies", icone: "verification" },
  { cle: "garantieSimple", icone: "calendrier" },
  { cle: "garantieAssistance", icone: "assistance" },
  { cle: "garantiePaiement", icone: "prix" },
];

export default async function APropos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const chiffres = [
    ...CHIFFRES,
    { valeur: String(LANGUES.length), cle: "chiffreLangues", icone: "globe" as NomIcone },
  ];

  return (
    <main className="bg-page pb-16">
      {/* hero */}
      <section className="relative">
        <div className="relative h-[min(440px,max(340px,27vw))] w-full overflow-hidden">
          <Image
            src="/images/a-propos/hero.jpg"
            alt={t("aPropos.heroAlt")}
            fill
            priority
            sizes="100vw"
            quality={92}
            className="object-cover object-[center_45%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.88) 0%, rgba(0,29,53,0.7) 34%, rgba(0,29,53,0.36) 60%, rgba(0,29,53,0.1) 84%, rgba(0,29,53,0) 100%)",
            }}
          />

          <div className="relative mx-auto flex h-full w-[92%] max-w-[1260px] flex-col justify-center pb-16">
            <p className="text-petit font-semibold uppercase tracking-[0.18em] text-white/80">
              {t("aPropos.surtitre")}
            </p>
            <h1 className="mt-2 max-w-[22ch] text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("aPropos.titre")}
            </h1>
            <p className="mt-4 max-w-[62ch] text-corps leading-relaxed text-white/90">
              {t("aPropos.chapeau")}
            </p>
          </div>
        </div>

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

      {/* notre histoire */}
      <section id="histoire" className="mx-auto w-[92%] max-w-[1260px] pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.3fr_0.7fr]">
          <span className="relative block aspect-[4/3] overflow-hidden rounded-card bg-champ">
            <Image
              src="/images/logement-1.png"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 28vw"
              className="object-cover"
            />
          </span>

          <div>
            <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
              {t("aPropos.notreHistoire")}
            </p>
            <h2 className="mt-2 text-titre-1 text-encre">{t("aPropos.histoireTitre")}</h2>
            <p className="mt-3 max-w-[62ch] text-corps leading-relaxed text-encre-douce">
              {t("aPropos.histoireTexte")}
            </p>

            <div className="mt-5">
              <a href="#mission">
                <Bouton variante="principal" largeur="contenu">
                  <span className="inline-flex items-center gap-2">
                    {t("aPropos.histoireAction")}
                    <Icone nom="chevron-droite" taille={16} />
                  </span>
                </Bouton>
              </a>
            </div>
          </div>

          <CarteDakar etiquette={t("aPropos.carteEtiquette")} />
        </div>
      </section>

      {/* en chiffres */}
      <section className="mx-auto mt-12 w-[92%] max-w-[1260px]">
        <div className="rounded-card bg-primaire p-7">
          <p className="text-petit font-semibold uppercase tracking-[0.18em] text-white/70">
            {t("aPropos.enChiffres")}
          </p>

          <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {chiffres.map((chiffre) => (
              <li key={chiffre.cle} className="flex items-center gap-4">
                <span className="shrink-0 text-white/70">
                  <Icone nom={chiffre.icone} taille={28} />
                </span>
                <span>
                  <span className="block text-[28px] font-bold leading-tight text-white chiffres-tabulaires">
                    {chiffre.valeur}
                  </span>
                  <span className="block text-petit text-white/80">
                    {t(`aPropos.${chiffre.cle}`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 border-t border-white/15 pt-4 text-legende text-white/70">
            {t("aPropos.chiffresNote")}
          </p>
        </div>
      </section>

      {/* mission et vision */}
      <section id="mission" className="mx-auto mt-12 w-[92%] max-w-[1260px] scroll-mt-24">
        <div className="grid gap-8 lg:grid-cols-2">
          {[
            { surtitre: "notreMission", titre: "missionTitre", texte: "missionTexte", icone: "cible" },
            { surtitre: "notreVision", titre: "visionTitre", texte: "visionTexte", icone: "statistiques" },
          ].map((bloc) => (
            <div key={bloc.surtitre} className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-teinte-bleu text-primaire">
                <Icone nom={bloc.icone as NomIcone} taille={24} />
              </span>
              <div>
                <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
                  {t(`aPropos.${bloc.surtitre}`)}
                </p>
                <h2 className="mt-1 text-titre-2 text-encre">{t(`aPropos.${bloc.titre}`)}</h2>
                <p className="mt-2 max-w-[56ch] text-corps leading-relaxed text-encre-douce">
                  {t(`aPropos.${bloc.texte}`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* nos valeurs */}
      <section className="mx-auto mt-12 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("aPropos.nosValeurs")}
        </p>

        <div className="mt-4 grid items-center gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALEURS.map((valeur) => (
              <li key={valeur.cle}>
                <span className="flex h-12 w-12 items-center justify-center rounded-control bg-teinte-bleu text-primaire">
                  <Icone nom={valeur.icone} taille={24} />
                </span>
                <span className="mt-3 block text-petit font-semibold text-encre">
                  {t(`aPropos.${valeur.cle}`)}
                </span>
                <span className="mt-1 block text-legende text-encre-douce">
                  {t(`aPropos.${valeur.cle}Texte`)}
                </span>
              </li>
            ))}
          </ul>

          <span className="relative block aspect-[4/3] overflow-hidden rounded-card bg-champ">
            <Image
              src="/images/logement-3.png"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 26vw"
              className="object-cover"
            />
          </span>
        </div>
      </section>

      {/* ensemble pour Dakar 2026 */}
      <section className="mx-auto mt-12 w-[92%] max-w-[1260px]">
        <Carte className="relative overflow-hidden border-0">
          <Image
            src="/images/banner-dakar.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[center_40%]"
          />
          <div className="absolute inset-0 bg-primaire/82" />

          <div className="relative flex flex-wrap items-center justify-between gap-5 p-7">
            <div>
              <p className="text-petit font-semibold uppercase tracking-[0.18em] text-white/70">
                {t("aPropos.ensemble")}
              </p>
              <p className="mt-1 text-titre-2 text-white">{t("aPropos.ensembleTitre")}</p>
              <p className="mt-1 max-w-[58ch] text-petit text-white/85">
                {t("aPropos.ensembleTexte")}
              </p>
            </div>
            <Lien href="/services">
              <Bouton variante="secondaire" largeur="contenu">
                <span className="inline-flex items-center gap-2">
                  {t("aPropos.ensembleAction")}
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
