import Image from "next/image";
import { Suspense } from "react";
import { Bouton, Carte, Icone, type NomIcone } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { ListeQuestions } from "@/features/aide/liste-questions";
import { ASSISTANCE, emailUrl, telUrl, whatsappUrl } from "@/lib/assistance";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Écran 14 · Centre d'aide — maquette du dossier aide.
 *
 * « Seul point d'entrée de l'assistance ; pas de bouton flottant » (§B.6).
 *
 * La maquette propose quatre canaux, dont un « Chat en ligne — disponible
 * maintenant ». Il n'y a pas de messagerie en direct, et un badge vert qui
 * promet une réponse immédiate là où personne ne répond est pire que pas de
 * canal du tout. WhatsApp tient ce rôle sur ce marché ; la quatrième carte mène
 * aux numéros d'urgence, qui manquaient à la maquette et comptent davantage.
 */
interface Canal {
  cle: string;
  icone: NomIcone;
  href: string;
  externe?: boolean;
  detail?: string;
  teinte: string;
}

export default async function Aide({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);
  const requete = q ?? "";

  const canaux: Canal[] = [
    {
      cle: "canalWhatsapp",
      icone: "whatsapp",
      href: whatsappUrl,
      externe: true,
      teinte: "bg-teinte-vert text-succes",
    },
    {
      cle: "canalEmail",
      icone: "enveloppe",
      href: emailUrl,
      detail: ASSISTANCE.email,
      teinte: "bg-teinte-bleu text-primaire",
    },
    {
      cle: "canalTelephone",
      icone: "telephone",
      href: telUrl,
      detail: ASSISTANCE.telephone,
      teinte: "bg-teinte-jaune text-alerte",
    },
    {
      cle: "canalUrgences",
      icone: "alerte",
      href: "/aide/urgences",
      teinte: "bg-teinte-rouge text-danger",
    },
  ];

  return (
    <main className="bg-page pb-16">
      <EnTete />

      {/* hero avec la recherche */}
      <section className="relative">
        <div className="relative min-h-[320px] w-full overflow-hidden">
          <Image
            src="/images/banner-dakar.png"
            alt={t("aide.heroAlt")}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_45%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.9) 0%, rgba(0,29,53,0.74) 36%, rgba(0,29,53,0.42) 62%, rgba(0,29,53,0.16) 86%, rgba(0,29,53,0.05) 100%)",
            }}
          />

          <div className="relative mx-auto w-[92%] max-w-[1180px] py-10">
            <p className="text-petit font-semibold uppercase tracking-[0.18em] text-white/80">
              {t("aide.centre")}
            </p>
            <h1 className="mt-2 max-w-[18ch] text-[clamp(28px,3.4vw,42px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("aide.heroTitre")}
            </h1>
            <p className="mt-3 max-w-[52ch] text-corps leading-relaxed text-white/90">
              {t("aide.heroTexte")}
            </p>

            {/* Formulaire GET natif : il marche avant l'hydratation, et la
                recherche devient une URL qu'on peut partager. */}
            <form
              action={`/${langue}/aide`}
              method="get"
              className="mt-6 flex flex-col gap-2 rounded-card bg-surface p-2 shadow-[0_18px_40px_-12px_rgb(2_20_38/0.34)] sm:flex-row"
            >
              <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <Icone nom="recherche" taille={20} className="shrink-0 text-encre-douce" />
                <span className="sr-only">{t("aide.rechercherLibelle")}</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={requete}
                  placeholder={t("aide.rechercherPlaceholder")}
                  className="min-h-[var(--size-control)] w-full min-w-0 bg-transparent text-petit text-encre outline-none placeholder:text-encre-douce"
                />
              </label>
              <Bouton type="submit" variante="principal" largeur="contenu">
                {t("aide.rechercher")}
              </Bouton>
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 grid w-[92%] max-w-[1180px] gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* questions fréquentes */}
        <section>
          <h2 className="text-titre-1 text-encre">{t("aide.faqTitre")}</h2>
          <div className="mt-3">
            <Suspense fallback={null}>
              <ListeQuestions requete={requete} />
            </Suspense>
          </div>

          <div className="mt-5">
            <Lien
              href="/aide/faq"
              className="inline-flex min-h-[var(--size-touch)] items-center gap-2 text-petit font-semibold text-primaire underline underline-offset-2"
            >
              {t("aide.voirToutesQuestions")}
              <Icone nom="chevron-droite" taille={16} />
            </Lien>
          </div>
        </section>

        {/* canaux d'assistance */}
        <section>
          <h2 className="text-titre-2 text-encre">{t("aide.assistanceTitre")}</h2>
          <p className="mt-2 text-petit text-encre-douce">{t("aide.assistanceTexte")}</p>

          <ul className="mt-4 space-y-3">
            {canaux.map((canal) => (
              <li key={canal.cle}>
                <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                  <CanalLien canal={canal}>
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-pill ${canal.teinte}`}
                    >
                      <Icone nom={canal.icone} taille={24} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-petit font-semibold text-encre">
                        {t(`aide.${canal.cle}`)}
                      </span>
                      <span className="mt-0.5 block text-legende text-encre-douce">
                        {t(`aide.${canal.cle}Texte`)}
                      </span>
                      {canal.detail && (
                        <span className="mt-1 block text-legende text-encre chiffres-tabulaires">
                          {canal.detail}
                        </span>
                      )}
                    </span>
                    <Icone
                      nom="chevron-droite"
                      taille={20}
                      className="shrink-0 text-encre-douce"
                    />
                  </CanalLien>
                </Carte>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-legende text-encre-douce">{t("aide.horaires")}</p>
        </section>
      </div>

      {/* toujours besoin d'aide */}
      <section className="mx-auto mt-10 w-[92%] max-w-[1180px]">
        <Carte className="border-0 bg-teinte-bleu">
          <div className="flex flex-wrap items-center gap-5 p-7">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill bg-surface text-primaire">
              <Icone nom="assistance" taille={28} />
            </span>
            <div className="min-w-[240px] flex-1">
              <p className="text-titre-2 text-encre">{t("aide.toujoursTitre")}</p>
              <p className="mt-1 max-w-[62ch] text-petit text-encre-douce">
                {t("aide.toujoursTexte")}
              </p>
            </div>
            <a href={telUrl}>
              <Bouton variante="principal" largeur="contenu" icone="telephone">
                {t("aide.toujoursAction")}
              </Bouton>
            </a>
          </div>
        </Carte>
      </section>
    </main>
  );
}

function CanalLien({ canal, children }: { canal: Canal; children: React.ReactNode }) {
  const classe = "flex items-center gap-4 p-4";

  if (canal.href.startsWith("/")) {
    return (
      <Lien href={canal.href} className={classe}>
        {children}
      </Lien>
    );
  }

  return (
    <a
      href={canal.href}
      className={classe}
      {...(canal.externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
