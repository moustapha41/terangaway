import Image from "next/image";
import { Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { CarteQuartiers } from "@/features/services/carte-quartiers";
import { FormulaireDemandeService } from "@/features/services/formulaire-demande-service";
import {
  APPLICATIONS_LIVRAISON,
  MOMENTS_PLAT,
  PLATS,
  QUARTIERS_TABLE,
  REPERES_PRIX,
  USAGES_TABLE,
  type MomentPlat,
} from "@/features/services/restauration";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Restauration — la page du service.
 *
 * Elle répond à trois questions dans l'ordre où elles se posent quand on
 * arrive : qu'est-ce qu'on mange ici, où va-t-on manger, et comment se faire
 * livrer quand on ne veut pas sortir. Le formulaire de demande ne vient
 * qu'après — on ne sait pas quoi demander tant qu'on ne sait pas ce qui existe.
 *
 * Aucun restaurant n'est nommé nulle part. Une adresse ferme ou change de
 * cuisinier, et une page qui la recommanderait encore enverrait le visiteur
 * dans le vide ; les quartiers, eux, gardent leur caractère, et c'est l'équipe
 * qui cherche la table du moment.
 *
 * `quartier` dans l'adresse amorce le message du formulaire, comme `site` sur
 * la page des guides.
 */
const ICONES_MOMENT: Record<MomentPlat, NomIcone> = {
  midi: "restauration",
  soir: "etoile",
  rue: "repere",
  boisson: "eau-chaude",
};

const ICONES_USAGE: Record<(typeof USAGES_TABLE)[number], NomIcone> = {
  bol: "groupe-electrogene",
  horaires: "horloge",
  teranga: "personnes",
  ramadan: "calendrier",
  regimes: "information",
  eau: "eau-chaude",
};

const FAQ = ["1", "2", "3", "4", "5"] as const;

export default async function Restauration({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ quartier?: string }>;
}) {
  const { locale } = await params;
  const { quartier } = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  // Le paramètre vient de l'extérieur : il n'amorce le formulaire que s'il
  // désigne un quartier connu.
  const choisi = QUARTIERS_TABLE.find((candidat) => candidat.cle === quartier);
  const messageInitial = choisi
    ? t("restauration.messagePour", { quartier: t(`restauration.quartier.${choisi.cle}Nom`) })
    : "";

  return (
    <main className="bg-page pb-16">
      {/* hero */}
      <section className="relative">
        <div className="relative h-[min(460px,max(340px,28vw))] w-full overflow-hidden">
          <Image
            src="/images/services/hero-restauration.jpg"
            alt={t("restauration.heroAlt")}
            fill
            priority
            sizes="100vw"
            quality={92}
            className="object-cover object-[center_58%]"
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
              <span className="text-white">{t("restauration.surtitre")}</span>
            </nav>

            <h1 className="mt-3 max-w-[20ch] text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("restauration.titre")}
            </h1>
            <p className="mt-4 max-w-[58ch] text-corps leading-relaxed text-white/90">
              {t("restauration.chapeau")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demande">
                <Bouton variante="secondaire" largeur="contenu">
                  <span className="inline-flex items-center gap-2">
                    {t("restauration.actionDemander")}
                    <Icone nom="chevron-droite" taille={16} />
                  </span>
                </Bouton>
              </a>
              <a
                href="#plats"
                className="inline-flex min-h-[var(--size-touch)] items-center rounded-control border border-white/40 px-5 text-petit font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("restauration.actionPlats")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* les plats, par moment de la journée */}
      <section id="plats" className="mx-auto w-[92%] max-w-[1260px] pt-12 scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("restauration.platsSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("restauration.platsTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("restauration.platsTexte")}
        </p>

        <div className="mt-8 space-y-8">
          {MOMENTS_PLAT.map((moment) => (
            <div key={moment}>
              <h3 className="flex items-center gap-2 text-petit font-semibold uppercase tracking-[0.12em] text-encre-douce">
                <Icone nom={ICONES_MOMENT[moment]} taille={16} />
                {t(`restauration.moment${moment[0].toUpperCase()}${moment.slice(1)}`)}
              </h3>

              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PLATS.filter((plat) => plat.moment === moment).map((plat) => (
                  <li key={plat.cle}>
                    <Carte className="h-full p-5">
                      <h4 className="text-petit font-semibold text-encre">
                        {t(`restauration.plat.${plat.cle}Nom`)}
                      </h4>
                      {plat.unesco !== undefined && (
                        <span className="mt-2 inline-flex items-center rounded-pill bg-teinte-jaune px-2 py-0.5 text-legende font-semibold text-jaune-fonce">
                          {t("restauration.platUnesco", { annee: String(plat.unesco) })}
                        </span>
                      )}
                      <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                        {t(`restauration.plat.${plat.cle}Texte`)}
                      </p>
                    </Carte>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* les usages de table */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("restauration.usagesSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("restauration.usagesTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("restauration.usagesTexte")}
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USAGES_TABLE.map((usage) => (
            <li key={usage}>
              <Carte className="h-full p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={ICONES_USAGE[usage]} taille={20} />
                </span>
                <h3 className="mt-4 text-petit font-semibold text-encre">
                  {t(`restauration.usage.${usage}Titre`)}
                </h3>
                <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                  {t(`restauration.usage.${usage}Texte`)}
                </p>
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {/* les ordres de grandeur */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("restauration.prixSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("restauration.prixTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("restauration.prixTexte")}
        </p>

        <ul className="mt-6 grid gap-px overflow-hidden rounded-card border border-contour bg-contour sm:grid-cols-3">
          {REPERES_PRIX.map((repere) => (
            <li key={repere} className="bg-surface px-5 py-5">
              <span className="block text-petit font-semibold text-encre">
                {t(`restauration.prix.${repere}Titre`)}
              </span>
              <span className="mt-1 block text-titre-2 text-primaire chiffres-tabulaires">
                {t(`restauration.prix.${repere}Montant`)}
              </span>
              <span className="mt-2 block text-legende leading-relaxed text-encre-douce">
                {t(`restauration.prix.${repere}Texte`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* où manger */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("restauration.quartiersSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("restauration.quartiersTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("restauration.quartiersTexte")}
        </p>

        <div className="mt-8">
          <CarteQuartiers />
        </div>
      </section>

      {/* se faire livrer */}
      <section className="mx-auto mt-14 w-[92%] max-w-[1260px]">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("restauration.livraisonSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("restauration.livraisonTitre")}</h2>
        <p className="mt-3 max-w-[70ch] text-corps leading-relaxed text-encre-douce">
          {t("restauration.livraisonTexte")}
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Carte className="p-6">
            <h3 className="flex items-center gap-2 text-petit font-semibold text-encre">
              <Icone nom="telephone" taille={16} />
              {t("restauration.livraisonAppsTitre")}
            </h3>
            <p className="mt-2 text-legende leading-relaxed text-encre-douce">
              {t("restauration.livraisonAppsTexte")}
            </p>

            <ul className="mt-5 divide-y divide-contour border-t border-contour">
              {APPLICATIONS_LIVRAISON.map((application) => (
                <li key={application.cle} className="py-3">
                  <a
                    href={`https://${application.domaine}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-4 hover:text-primaire"
                  >
                    <span>
                      <span className="block text-petit font-semibold text-encre">
                        {application.nom}
                      </span>
                      <span className="mt-0.5 block text-legende leading-relaxed text-encre-douce">
                        {t(`restauration.app.${application.cle}Texte`)}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0 text-legende text-encre-douce">
                      {application.domaine}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <p className="mt-4 rounded-card bg-teinte-jaune px-4 py-3 text-legende leading-relaxed text-encre">
              {t("restauration.livraisonAvertissement")}
            </p>
          </Carte>

          <div className="grid gap-5">
            <Carte className="p-6">
              <h3 className="flex items-center gap-2 text-petit font-semibold text-encre">
                <Icone nom="whatsapp" taille={16} />
                {t("restauration.livraisonWhatsappTitre")}
              </h3>
              <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                {t("restauration.livraisonWhatsappTexte")}
              </p>
            </Carte>

            <Carte className="p-6">
              <h3 className="flex items-center gap-2 text-petit font-semibold text-encre">
                <Icone nom="assistance" taille={16} />
                {t("restauration.livraisonEquipeTitre")}
              </h3>
              <p className="mt-2 text-legende leading-relaxed text-encre-douce">
                {t("restauration.livraisonEquipeTexte")}
              </p>
            </Carte>
          </div>
        </div>
      </section>

      {/* la demande */}
      <section id="demande" className="mx-auto mt-14 w-[92%] max-w-[680px] scroll-mt-24">
        <p className="text-petit font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
          {t("restauration.demandeSurtitre")}
        </p>
        <h2 className="mt-2 text-titre-1 text-encre">{t("restauration.demandeTitre")}</h2>
        <p className="mt-3 text-corps leading-relaxed text-encre-douce">
          {t("restauration.demandeTexte")}
        </p>

        <div className="mt-7">
          <FormulaireDemandeService service="restauration" messageInitial={messageInitial} />
        </div>
      </section>

      {/* questions fréquentes */}
      <section className="mx-auto mt-14 w-[92%] max-w-[860px]">
        <h2 className="text-titre-1 text-encre">{t("restauration.faqTitre")}</h2>
        <dl className="mt-6 divide-y divide-contour overflow-hidden rounded-card border border-contour bg-surface">
          {FAQ.map((numero) => (
            <div key={numero} className="p-5">
              <dt className="text-petit font-semibold text-encre">
                {t(`restauration.faqQ${numero}`)}
              </dt>
              <dd className="mt-2 text-petit leading-relaxed text-encre-douce">
                {t(`restauration.faqR${numero}`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
