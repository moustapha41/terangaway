import Image from "next/image";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { formaterPrix, prixAffiche } from "@/lib/prix";
import type { Equipement } from "@teranga/contracts";
import { logementParId } from "@/mocks/api";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Heart,
  MapPin,
  Snowflake,
  Star,
  Users,
  Waves,
  Wifi,
} from "lucide-react";

/**
 * Quatre logements mis en avant, **lus dans le catalogue**.
 *
 * Ils y étaient recopiés à la main : les nombres avaient déjà divergé (120 avis
 * affichés ici contre 24 au catalogue) et les liens pointaient vers des
 * identifiants inventés — « /logements/pullman » au lieu du slug réel — donc
 * les quatre cartes de la page d'accueil menaient à des 404.
 *
 * En lisant la source, la carte ne peut plus mentir ni mener nulle part.
 */
const MIS_EN_AVANT = ["l-001", "l-002", "l-003", "l-004"];

const ICONE_EQUIPEMENT: Partial<Record<Equipement, typeof Wifi>> = {
  piscine: Waves,
  climatisation: Snowflake,
  wifi: Wifi,
};

export async function HebergementsRecommandes({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  // Cette bande décore la page d'accueil ; elle n'en est pas le sujet. Si le
  // catalogue ne répond pas, la section disparaît et le reste de l'accueil
  // — la recherche, les services, les repères — continue de servir.
  let logements: NonNullable<Awaited<ReturnType<typeof logementParId>>>[] = [];
  try {
    logements = (await Promise.all(MIS_EN_AVANT.map(logementParId))).filter(
      (l): l is NonNullable<typeof l> => l !== null,
    );
  } catch (erreur) {
    console.error("[accueil] sélection recommandée indisponible", erreur);
    return null;
  }

  return (
    <section className="bg-white">
      <div className="mx-auto w-[87.5%] max-w-[1260px] py-14 md:py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jaune-fonce">
              {t("logements.surtitre")}
            </p>
            <h2 className="mt-3 text-[clamp(26px,2.6vw,34px)] font-bold tracking-[-0.02em] text-nuit">
              {t("logements.titre")}
            </h2>
            <span className="mt-2 block h-[3px] w-[48px] rounded-full bg-jaune-vif" />
          </div>

          {/* `?tri=note` et non `/logements` tout court : sans critère, cette
              adresse est l'accueil du parcours (écran 01) et ne montre que
              quatre offres. Un lien qui annonce « voir tous les logements »
              doit mener aux vingt-quatre, triées comme la sélection qu'on
              vient de quitter. L'écran 01 pointe déjà là pour la même raison. */}
          <Lien
            href="/logements?tri=note"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-nuit underline decoration-nuit/30 underline-offset-4 transition-colors hover:decoration-nuit"
          >
            {t("logements.voirTous")}
            <ArrowRight strokeWidth={2} className="h-4 w-4" />
          </Lien>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4 lg:gap-5">
          {logements.map((logement) => (
            <article
              key={logement.id}
              className="relative overflow-hidden rounded-[16px] border border-bordure/80 bg-white shadow-[0_8px_24px_-12px_rgb(2_20_38/0.18)] transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.22)]"
            >
              <Lien href={`/logements/${logement.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={logement.photos[0].url}
                    alt={logement.photos[0].alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />

                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-nuit px-2.5 py-1 text-[12px] font-semibold text-white">
                    <BadgeCheck
                      strokeWidth={2}
                      className="h-3.5 w-3.5 text-jaune-vif"
                    />
                    {t("commun.verifie")}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[16px] font-bold leading-snug text-nuit">
                      {logement.titre}
                    </h3>
                    <span className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-nuit">
                      <Star
                        strokeWidth={0}
                        className="h-3.5 w-3.5 fill-jaune-vif text-jaune-vif"
                      />
                      <span className="chiffres-tabulaires">{logement.note?.toLocaleString(langue, { minimumFractionDigits: 1 })}</span>
                      <span className="font-normal text-gris">
                        ({logement.nombreAvis})
                      </span>
                    </span>
                  </div>

                  <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-gris">
                    <MapPin strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0" />
                    {`${logement.quartier}, ${logement.ville}`}
                  </p>

                  <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-gris">
                    <li className="inline-flex items-center gap-1">
                      <BedDouble strokeWidth={1.7} className="h-3.5 w-3.5" />
                      {t("logements.chambres", { nombre: logement.chambres })}
                    </li>
                    <li className="inline-flex items-center gap-1">
                      <Users strokeWidth={1.7} className="h-3.5 w-3.5" />
                      {t("logements.personnes", { nombre: logement.capacite })}
                    </li>
                    {/* Un seul équipement, le plus parlant de ceux que porte
                        l'offre, pour ne pas surcharger la carte. */}
                    {(["piscine", "climatisation", "wifi"] as const)
                      .filter((e) => logement.equipements.includes(e))
                      .slice(0, 1)
                      .map((e) => {
                        const Icone = ICONE_EQUIPEMENT[e] ?? Wifi;
                        return (
                          <li key={e} className="inline-flex items-center gap-1">
                            <Icone strokeWidth={1.7} className="h-3.5 w-3.5" />
                            {t(`equipement.${e}`)}
                          </li>
                        );
                      })}
                  </ul>

                  <p className="mt-4 text-[17px] font-bold text-nuit">
                    <span className="chiffres-tabulaires">
                      {formaterPrix(prixAffiche(logement).montant, langue)}
                    </span>
                    <span className="ml-1 text-[13.5px] font-normal text-gris">
                      {t(prixAffiche(logement).cleUnite)}
                    </span>
                  </p>
                </div>
              </Lien>

              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-nuit backdrop-blur-sm"
              >
                <Heart strokeWidth={1.8} className="h-[18px] w-[18px]" />
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
