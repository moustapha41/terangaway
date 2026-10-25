import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { RetourAccueil } from "@/components/layout/retour-accueil";
import { SelecteurLangue } from "@/components/layout/selecteur-langue";
import { ouvrirDemandeParLien } from "@/features/demande/acces-actions";
import { REFUS_LIEN, type RefusLien } from "@/features/demande/refus-lien";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Le jeton est dans l'URL : il ne doit pas fuiter par l'en-tête Referer, ni
 * rester dans un index de recherche.
 */
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/**
 * Arrivée depuis le lien de l'e-mail de confirmation.
 *
 * Rien n'est consommé ici : la page s'affiche, et c'est le bouton — une action
 * serveur — qui échange le jeton. Un robot qui suit le lien ne l'use donc pas.
 */
export default async function AccesDemande({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; jeton: string }>;
  searchParams: Promise<{ refus?: string }>;
}) {
  const { locale, jeton } = await params;
  const { refus } = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const refusConnu = (REFUS_LIEN as readonly string[]).includes(refus ?? "")
    ? (refus as RefusLien)
    : undefined;
  const messageRefus = refusConnu
    ? {
        LIEN_EXPIRE: t("accesDemande.expire"),
        LIEN_DEJA_UTILISE: t("accesDemande.utilise"),
        LIEN_INVALIDE: t("accesDemande.invalide"),
        TROP_DE_TENTATIVES: t("accesDemande.trop"),
      }[refusConnu]
    : undefined;

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-primaire">
      <div className="fixed inset-0 pointer-events-none">
        <Image
          src="/images/fond-demande.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-primaire/35 via-primaire/15 to-primaire/75"
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-3.5 py-3.5 sm:px-8 sm:py-5">
        <header className="flex items-center justify-between gap-3">
          <RetourAccueil langue={langue} />
          <SelecteurLangue className="rounded-pill bg-surface/95 px-4 py-1.5 shadow-[0_8px_24px_-12px_rgb(2_20_38/0.45)] backdrop-blur-sm" />
        </header>

        <div className="flex flex-1 items-center justify-center py-6">
          <section className="w-full max-w-[460px] rounded-[26px] bg-surface/85 p-6 text-center shadow-[0_28px_70px_-24px_rgb(2_20_38/0.55)] backdrop-blur-xl">
            <Image
              src="/images/logo-complet.png"
              alt="Teranga Way"
              width={775}
              height={205}
              priority
              className="mx-auto h-auto w-[170px]"
            />
            <h1 className="mt-6 text-[22px] font-bold tracking-[-0.02em] text-encre">
              {t("accesDemande.titre")}
            </h1>

            {messageRefus ? (
              <>
                <p role="alert" className="mt-3 text-[14px] font-semibold text-[#B42318]">
                  {messageRefus}
                </p>
                <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-encre-douce">
                  {t("accesDemande.aide")}
                </p>
                <div className="mt-6 space-y-2.5 sm:mx-auto sm:max-w-[320px]">
                  <Lien
                    href="/connexion"
                    className="flex h-[48px] w-full items-center justify-center rounded-pill bg-primaire text-[15px] font-semibold text-white"
                  >
                    {t("accesDemande.connexion")}
                  </Lien>
                  <Lien
                    href="/"
                    className="flex h-[44px] w-full items-center justify-center rounded-pill border border-contour bg-surface text-[14px] font-semibold text-encre"
                  >
                    {t("accesDemande.accueil")}
                  </Lien>
                </div>
              </>
            ) : (
              <>
                <p className="mx-auto mt-3 max-w-[38ch] text-[14px] leading-relaxed text-encre-douce">
                  {t("accesDemande.texte")}
                </p>
                <form action={ouvrirDemandeParLien} className="mt-6 sm:mx-auto sm:max-w-[320px]">
                  <input type="hidden" name="jeton" value={jeton} />
                  <input type="hidden" name="locale" value={langue} />
                  <button
                    type="submit"
                    className="group flex h-[48px] w-full items-center justify-center gap-2.5 rounded-pill bg-primaire text-[15.5px] font-semibold text-white shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-colors hover:bg-[#072c4e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
                  >
                    <span>{t("accesDemande.bouton")}</span>
                    <ArrowRight strokeWidth={2.2} className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
