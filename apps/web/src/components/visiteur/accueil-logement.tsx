import Image from "next/image";
import type { Logement } from "@teranga/contracts";
import { Icone, type NomIcone } from "@teranga/ui";
import { BarreDeRecherche } from "@/components/recherche/barre-de-recherche";
import { CarteLogement } from "@/components/visiteur/carte-logement";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";

/**
 * Page d'accueil du parcours logement — maquette écran 01.
 *
 * Elle s'affiche à `/logements` tant qu'aucun critère n'est présent dans l'URL ;
 * dès qu'il y en a un, la même adresse montre les résultats. Une seule page pour
 * le fil d'Ariane « Accueil › Logement », et un lien partagé reste parlant.
 */
const REASSURANCE: { cle: string; icone: NomIcone }[] = [
  { cle: "verifies", icone: "verification" },
  { cle: "assistance", icone: "assistance" },
  { cle: "aucunPaiement", icone: "prix" },
  { cle: "securite", icone: "information" },
];

export function AccueilLogement({
  langue,
  populaires,
  ville,
}: {
  langue: Langue;
  populaires: Logement[];
  /** Absente tant qu'aucune recherche n'a été faite : la sélection porte alors
   * sur tout le catalogue, et le titre ne nomme aucune ville. */
  ville?: string;
}) {
  const t = traducteurPour(langue);

  return (
    <>
      <section className="relative">
        <div className="relative h-[min(560px,max(420px,34vw))] w-full overflow-hidden">
          <Image
            src="/images/logement-4.png"
            alt={t("accueilLogement.alt")}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_60%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,29,53,0.78) 0%, rgba(0,29,53,0.6) 26%, rgba(0,29,53,0.3) 48%, rgba(0,29,53,0.1) 68%, rgba(0,29,53,0) 85%)",
            }}
          />

          <div className="relative mx-auto flex h-full w-[92%] max-w-[1260px] flex-col justify-center pb-[90px]">
            <h1 className="max-w-[18ch] text-[clamp(30px,3.6vw,46px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t("accueilLogement.titre")}
            </h1>
            <p className="mt-4 max-w-[46ch] text-[clamp(15px,1.4vw,19px)] leading-relaxed text-white/90">
              {t("accueilLogement.sousTitre")}
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto -mt-[44px] sm:-mt-[78px] w-[92%] max-w-[1260px]">
          <BarreDeRecherche variante="logement" />
        </div>
      </section>

      {/* réassurance */}
      <section className="mx-auto w-[92%] max-w-[1260px] py-12">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {REASSURANCE.map((point) => (
            <li key={point.cle} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-teinte-vert text-succes">
                <Icone nom={point.icone} taille={24} />
              </span>
              <span className="text-petit font-semibold text-encre">
                {t(`accueilLogement.${point.cle}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* populaires */}
      <section className="mx-auto w-[92%] max-w-[1260px] pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-titre-1 text-encre">
            {ville
              ? t("accueilLogement.populaires", { ville })
              : t("accueilLogement.populairesPartout")}
          </h2>
          <Lien
            href={ville ? `/logements?ville=${encodeURIComponent(ville)}` : "/logements?tri=note"}
            className="text-petit font-semibold text-primaire underline underline-offset-4"
          >
            {t("accueilLogement.voirTous")}
          </Lien>
        </div>

        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {populaires.map((logement) => (
            <li key={logement.id}>
              <CarteLogement logement={logement} langue={langue} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
