import Image from "next/image";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { BarreDeRecherche } from "@/components/recherche/barre-de-recherche";

/**
 * Valeurs relevées sur base/maquette.png, artboard ~1440.
 *
 * La photo n'a ni filtre ni retouche de couleur. En revanche le logo DAKAR 2026
 * a été **sorti** de l'image : il y était incrusté, et aucune règle CSS ne peut
 * réduire un élément peint dans une photo sans réduire la photo entière. Il est
 * désormais posé par-dessus, à 18,1 % de la largeur — la valeur relevée sur la
 * maquette, contre 20,9 % quand il était incrusté.
 *
 * base/hero.png reste intact. Les deux fichiers dérivés sont dans public/images.
 */
export function Hero({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <section className="relative w-full pb-2">
      {/* Plan photo : overflow isolé pour ne pas couper la carte flottante */}
      <div className="relative h-[min(640px,max(500px,38vw))] w-full overflow-hidden">
        <Image
          src="/images/hero-sans-logo.png"
          alt={t("hero.alt")}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_22%]"
        />

        {/* Marque olympique, posée par-dessus la photo. Elle est décorative ici —
            le titre de la page porte déjà « JOJ Dakar 2026 » — d'où alt="". */}
        <Image
          src="/images/logo-joji.png"
          alt=""
          width={413}
          height={211}
          priority
          className="pointer-events-none absolute right-[6%] top-[9.5%] w-[clamp(120px,18.1%,261px)] select-none"
          style={{ height: "auto" }}
        />

        {/* voile bleu nuit — opacités calées sur resuktat.png (plus léger que la 1re passe) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,29,53,0.68) 0%, rgba(0,29,53,0.55) 14%, rgba(0,29,53,0.36) 28%, rgba(0,29,53,0.18) 42%, rgba(0,29,53,0.08) 54%, rgba(0,29,53,0) 66%)",
          }}
        />

        <div className="relative mx-auto flex h-full w-[87.5%] max-w-[1260px] flex-col justify-center pb-[72px] pt-4">
          <p className="text-[15px] font-medium uppercase tracking-[0.22em] text-white/85">
            {t("hero.surtitre")}
          </p>

          <h1 className="mt-3 text-[clamp(36px,4.2vw,58px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            {t("hero.titre")}
            <br />
            {t("hero.titreSuite")}
            <br />
            <span className="text-jaune-vif">{t("hero.titreLieu")}</span>
          </h1>

          <p className="mt-4 max-w-[520px] text-[clamp(16px,1.45vw,20px)] leading-[1.45] text-white/90">
            {t("hero.sousTitre")}
          </p>

          <span className="mt-5 block h-[4px] w-[48px] rounded-full bg-jaune-vif" />
        </div>
      </div>

      {/* carte qui chevauche le bas de la photo, comme sur resuktat.png */}
      <div className="relative z-10 mx-auto -mt-[48px] sm:-mt-[96px] w-[92%] sm:w-[87.5%] max-w-[1260px]">
        <BarreDeRecherche />
      </div>
    </section>
  );
}
