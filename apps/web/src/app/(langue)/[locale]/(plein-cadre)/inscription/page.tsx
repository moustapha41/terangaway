import Image from "next/image";
import { redirect } from "next/navigation";
import { RetourAccueil } from "@/components/layout/retour-accueil";
import { googleConfigure } from "@/lib/auth/google";
import { FormulaireInscription } from "@/features/compte/formulaire-inscription";
import { visiteurConnecte } from "@/features/compte/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Inscription — écran plein cadre, d'après `maquette_signup.png`.
 *
 * Distincte de `/connexion`, et volontairement : l'une crée un compte, l'autre
 * ouvre une session sur un compte existant. Les confondre, c'est le défaut que
 * ce parcours corrige.
 *
 * Aucune session n'est ouverte ici. Le formulaire mène à
 * `/inscription/verification`, et le compte n'existe vraiment qu'après — cette
 * étape-là garde l'en-tête du site, elle n'est pas dans la maquette.
 *
 * La maquette tient en deux colonnes : la promesse à gauche sur la photo, la
 * carte à droite. Sous 1024 px il n'y a plus deux colonnes à tenir : la carte
 * passe dessous, et le titre se réduit pour lui laisser la place.
 */
export default async function Inscription({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ suite?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { suite } = await searchParams;
  const t = traducteurPour(langue);

  // Déjà connecté : s'inscrire n'a plus de sens, on va là où la personne allait.
  const visiteur = await visiteurConnecte();
  if (visiteur) {
    const cible = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/compte";
    redirect(cible.startsWith(`/${langue}`) ? cible : `/${langue}${cible}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primaire">
      <Image
        src="/images/fond-inscription.jpg"
        alt={t("inscription.illustrationAlt")}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[35%_center]"
      />
      {/* Voile clair à gauche. Sans lui, « commence ici » tombe sur la chevelure
          de l'athlète et disparaît ; avec lui, le titre repose sur un lavis
          uniforme. Il ne règle pas tout — voir la note de contraste ci-dessous
          — mais il supprime le pire, qui est le fond changeant sous un mot. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.94)_0%,rgb(255_255_255/0.88)_26%,rgb(255_255_255/0.45)_44%,rgb(255_255_255/0)_62%)]"
      />

      <RetourAccueil
        langue={langue}
        className="absolute right-6 top-6 z-10 lg:right-10 lg:top-8 [@media(max-height:860px)]:lg:top-5"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:gap-10 lg:px-10 [@media(max-height:860px)]:gap-4 [@media(max-height:860px)]:py-3">
        <Lien
          href="/"
          className="block w-[180px] shrink-0 sm:w-[215px] lg:absolute lg:left-10 lg:top-8 [@media(max-height:860px)]:w-[150px] [@media(max-height:860px)]:sm:w-[150px] [@media(max-height:860px)]:lg:top-5"
        >
          <Image
            src="/images/logo-complet.png"
            alt="Teranga Way"
            width={775}
            height={205}
            priority
            className="h-auto w-full"
          />
        </Lien>

        <div className="lg:flex-1">
          <h1 className="text-[clamp(34px,5vw,62px)] font-bold leading-[1.05] tracking-[-0.025em] text-primaire [@media(max-height:860px)]:text-[clamp(28px,3.6vw,44px)]">
            {t("inscription.aventure")}
            <br />
            <span className="text-jaune-fonce">{t("inscription.aventureSuite")}</span>
          </h1>
          <p className="mt-3 max-w-[460px] text-[clamp(15px,1.5vw,20px)] leading-snug text-primaire/85 [@media(max-height:860px)]:mt-2 [@media(max-height:860px)]:text-[15px]">
            {t("inscription.sousTitre")}
          </p>
        </div>

        <section className="w-full rounded-[26px] bg-sable/95 p-6 shadow-[0_28px_70px_-24px_rgb(2_20_38/0.55)] backdrop-blur-sm sm:p-8 lg:w-[480px] lg:shrink-0 [@media(max-height:860px)]:p-4 [@media(max-height:860px)]:sm:p-5 [@media(max-height:860px)]:lg:w-[430px]">
          <h2 className="text-center text-[26px] font-bold tracking-[-0.02em] text-primaire sm:text-[30px] [@media(max-height:860px)]:text-[22px] [@media(max-height:860px)]:sm:text-[22px]">
            {t("inscription.titreCarte")}
          </h2>

          <div className="mt-6 [@media(max-height:860px)]:mt-4">
            <FormulaireInscription suite={suite} googleActif={googleConfigure()} />
          </div>

          <p className="mt-5 text-center text-[14px] text-encre-douce [@media(max-height:860px)]:mt-3 [@media(max-height:860px)]:text-[13px]">
            {t("inscription.dejaUnCompte")}{" "}
            <Lien
              href={`/connexion${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
              className="font-semibold text-primaire underline underline-offset-4"
            >
              {t("inscription.seConnecter")}
            </Lien>
          </p>
        </section>
      </div>
    </main>
  );
}
