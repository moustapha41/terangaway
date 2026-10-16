import Image from "next/image";
import { redirect } from "next/navigation";
import { CalendarDays, Map, MapPin } from "lucide-react";
import { Bandeau } from "@teranga/ui";
import { RetourAccueil } from "@/components/layout/retour-accueil";
import { SelecteurLangue } from "@/components/layout/selecteur-langue";
import { Lien } from "@/lib/i18n/lien";
import { FormulaireConnexionVisiteur } from "@/features/compte/formulaire-connexion";
import { visiteurConnecte } from "@/features/compte/session";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { apiMockActive } from "@/lib/api/http";
import { googleConfigure } from "@/lib/auth/google";

/**
 * Connexion visiteur — écran plein cadre, d'après `maquette_login.png`.
 *
 * Pas d'en-tête ni de pied de page : la maquette pose la photo de la corniche
 * sur toute la fenêtre et n'y laisse que quatre choses — le sélecteur de
 * langue, la carte, les trois repères et la signature de Dakar. Le reste de la
 * navigation reviendrait à offrir une sortie au milieu d'une entrée.
 *
 * La connexion n'est jamais une porte d'entrée : on n'y arrive que pour
 * retrouver ses demandes (§B.1). D'où le lien de retour discret sur le logo.
 */
export default async function Connexion({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { suite, erreur } = await searchParams;
  const t = traducteurPour(langue);

  const visiteur = await visiteurConnecte();
  if (visiteur) {
    const cible = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/compte";
    const chemin = cible.startsWith(`/${langue}`) ? cible : `/${langue}${cible}`;
    redirect(chemin);
  }

  const REPERES = [
    { icone: MapPin, titre: t("connexion.decouvrir"), texte: t("connexion.decouvrirTexte") },
    { icone: CalendarDays, titre: t("connexion.planifier"), texte: t("connexion.planifierTexte") },
    { icone: Map, titre: t("connexion.explorer"), texte: t("connexion.explorerTexte") },
  ];

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primaire">
      {/* La photo couvre la fenêtre ; `priority` parce qu'elle est le fond de
          l'unique écran, et non une illustration qu'on peut faire attendre. */}
      <Image
        src="/images/fond-connexion.jpg"
        alt={t("connexion.illustrationAlt")}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Voile bleu nuit : sans lui, le texte blanc du bas passe sur le sable. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-primaire/35 via-primaire/10 to-primaire/75"
      />

      <div className="relative flex min-h-screen flex-col px-5 py-4 sm:px-8 sm:py-5 [@media(max-height:860px)]:py-2.5">
        <div className="flex items-center justify-between gap-3">
          <RetourAccueil langue={langue} />
          <SelecteurLangue className="rounded-pill bg-surface/95 px-4 py-1.5 shadow-[0_8px_24px_-12px_rgb(2_20_38/0.45)] backdrop-blur-sm" />
        </div>

        <div className="flex flex-1 items-center justify-center py-5 [@media(max-height:860px)]:py-2">
          {/* 88 % d'opacité, et pas moins : sous la carte, le feuillage du bas
              descend à ~55 de luminosité. À 80 %, le texte secondaire tombait à
              4,04 : 1 contre le 4,5 exigé (§C.6) ; à 88 % il remonte à 4,71 et
              la photo se devine toujours au travers, renforcée par le flou. */}
          <section className="w-full max-w-[480px] rounded-[26px] bg-surface/88 p-5 shadow-[0_28px_70px_-24px_rgb(2_20_38/0.55)] backdrop-blur-xl sm:p-6 [@media(max-height:860px)]:p-4 [@media(max-height:860px)]:sm:p-4">
            <Lien href="/" className="mx-auto block w-[185px] sm:w-[205px] [@media(max-height:860px)]:w-[155px] [@media(max-height:860px)]:sm:w-[155px]">
              <Image
                src="/images/logo-complet.png"
                alt="Teranga Way"
                width={775}
                height={205}
                priority
                className="h-auto w-full"
              />
            </Lien>

            <h1 className="mt-4 text-center text-[23px] font-bold tracking-[-0.02em] text-encre sm:text-[26px] [@media(max-height:860px)]:mt-2.5 [@media(max-height:860px)]:text-[20px] [@media(max-height:860px)]:sm:text-[20px]">
              {t("compte.bienvenue")} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mx-auto mt-1.5 max-w-[320px] text-center text-[14px] leading-snug text-encre-douce [@media(max-height:860px)]:text-[13px]">
              {t("compte.bienvenueTexte")}
            </p>

            <div className="mt-5 [@media(max-height:860px)]:mt-3.5">
              {/* Le motif vient de `/api/auth/google/callback`, qui ne sait
                  rien dire au visiteur : il ne peut que renvoyer ici. */}
              {erreur && (
                <div className="mb-4">
                  <Bandeau variante="erreur">{t(messageGoogle(erreur))}</Bandeau>
                </div>
              )}

              <FormulaireConnexionVisiteur
                suite={suite ?? "/mes-demandes"}
                codeDemo={apiMockActive() ? CODE_DE_DEMONSTRATION : undefined}
                googleActif={googleConfigure()}
              />
            </div>

            {/*
              Le bandeau « le code est 123456 » a quitté cet écran : il ne figure
              pas sur la maquette. Il n'y perdait rien d'essentiel — le code de
              démonstration n'a de sens que derrière le lien « Mot de passe
              oublié ? », là où le formulaire de code s'ouvre, et c'est là qu'il
              est désormais annoncé.
            */}
            <p className="mt-4 text-center text-[13.5px] text-encre-douce [@media(max-height:860px)]:mt-2.5">
              {t("compte.pasEncoreDeCompte")}{" "}
              <Lien
                href={`/inscription${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
                className="font-semibold text-primaire underline underline-offset-4"
              >
                {t("compte.creerUnCompte")}
              </Lien>
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6">
          {/* Les trois repères, séparés par un filet comme sur la maquette. */}
          <ul className="flex flex-wrap items-stretch text-white">
            {REPERES.map(({ icone: Icone, titre, texte }, rang) => (
              <li
                key={titre}
                className={
                  "flex flex-col items-center gap-1.5 px-5 text-center sm:px-8 " +
                  (rang > 0 ? "border-l border-white/25" : "")
                }
              >
                <Icone strokeWidth={1.7} className="h-[22px] w-[22px] [@media(max-height:860px)]:h-[18px] [@media(max-height:860px)]:w-[18px]" />
                <span className="text-[14px] font-semibold leading-none">{titre}</span>
                <span className="text-[12.5px] text-white/75">{texte}</span>
              </li>
            ))}
          </ul>

          {/* « Dakar » est une écriture manuscrite que le projet n'embarque pas :
              seule Inter est chargée. Plutôt que de l'imiter avec une police
              approchante, le mot est découpé de la maquette, fond ôté. Le reste
              — la ligne capitale et le tiret doré — se compose en CSS. */}
          <div className="ml-auto flex flex-col items-center">
            <Image
              src="/images/signature-dakar.png"
              alt="Dakar"
              width={420}
              height={168}
              className="h-auto w-[130px] sm:w-[160px] [@media(max-height:860px)]:w-[108px] [@media(max-height:860px)]:sm:w-[108px]"
            />
            <span className="mt-1 text-[11px] uppercase tracking-[0.42em] text-white/85 sm:text-[12px]">
              {t("connexion.vousAttend")}
            </span>
            <span className="mt-2 block h-[3px] w-[64px] rounded-pill bg-jaune-vif" />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Le motif renvoyé par le retour Google, traduit en clé de catalogue. */
function messageGoogle(motif: string): string {
  switch (motif) {
    case "google-annule":
      return "compte.erreurGoogle.googleAnnule";
    case "google-non-verifie":
      return "compte.erreurGoogle.googleNonVerifie";
    case "google-indisponible":
      return "compte.erreurGoogle.googleIndisponible";
    default:
      return "compte.erreurGoogle.google";
  }
}
