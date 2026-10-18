import Image, { getImageProps } from "next/image";
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

  /*
   * Deux photos, une seule requête.
   *
   * Le cadrage paysage du bureau ne tient pas sur un téléphone : recadré par
   * `object-cover`, il coupe ce qu'il fallait montrer. On change donc d'image,
   * pas de recadrage — c'est ce que Next appelle l'« art direction ».
   *
   * Deux `<Image>` superposés avec `hidden` auraient été plus courts, et le
   * navigateur aurait téléchargé les deux : une photo masquée se charge quand
   * même. Sur la photo qui porte le LCP, en 3G, cela se paie comptant. Avec
   * `<picture>`, le navigateur choisit **avant** de télécharger, et chaque
   * source garde les tailles et les formats optimisés par Next.
   */
  const commun = { alt: t("hero.alt"), fill: true, priority: true, sizes: "100vw" } as const;
  const bureau = getImageProps({ ...commun, src: "/images/hero-sans-logo.png" }).props;
  const { srcSet: jeuMobile } = getImageProps({ ...commun, src: "/images/hero-mobile.png" }).props;

  return (
    <section className="relative w-full pb-2">
      {/* Plan photo : overflow isolé pour ne pas couper la carte flottante.
          380 px sur téléphone — la photo mobile est en 4:3, et la hauteur de
          500 px du bureau en rognait un tiers de la largeur. */}
      <div className="relative h-[380px] w-full overflow-hidden md:h-[min(640px,max(500px,38vw))]">
        <picture>
          {/* L'ordre compte : le navigateur retient la première source dont la
              condition est vraie. */}
          <source media="(min-width: 768px)" srcSet={bureau.srcSet} />
          <source media="(max-width: 767px)" srcSet={jeuMobile} />
          {/* `bureau` fournit aussi l'image de repli — celle que reçoit un
              navigateur qui ignorerait `<picture>` — et les styles que
              `fill` pose d'ordinaire lui-même. */}
          <img
            {...bureau}
            alt={t("hero.alt")}
            className="object-cover object-[70%_center] md:object-[center_22%]"
          />
        </picture>

        {/* Marque olympique, posée par-dessus la photo. Elle est décorative ici —
            le titre de la page porte déjà « JOJ Dakar 2026 » — d'où alt="".
            Masquée sous 768 px : la photo mobile la porte déjà, incrustée. */}
        <Image
          src="/images/logo-joji.png"
          alt=""
          width={413}
          height={211}
          priority
          className="pointer-events-none absolute right-[6%] top-[9.5%] hidden w-[clamp(120px,18.1%,261px)] select-none md:block"
          style={{ height: "auto" }}
        />

        {/* Voile bleu nuit, dans le sens de la lecture.
            Sur téléphone, le texte occupe toute la largeur et se pose sur un
            ciel clair et un soleil couchant : un dégradé horizontal n'y
            protégerait rien. Il descend donc du haut, là où le titre commence,
            et relâche vers la côte pour lui laisser ses couleurs. */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,29,53,0.74) 0%, rgba(0,29,53,0.6) 45%, rgba(0,29,53,0.3) 78%, rgba(0,29,53,0.12) 100%)",
          }}
        />

        {/* opacités calées sur resuktat.png (plus léger que la 1re passe) */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,29,53,0.68) 0%, rgba(0,29,53,0.55) 14%, rgba(0,29,53,0.36) 28%, rgba(0,29,53,0.18) 42%, rgba(0,29,53,0.08) 54%, rgba(0,29,53,0) 66%)",
          }}
        />

        <div className="relative mx-auto flex h-full w-[92%] max-w-[1260px] flex-col justify-center pb-[64px] pt-4 sm:w-[87.5%] md:pb-[72px]">
          <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/85 sm:text-[15px]">
            {t("hero.surtitre")}
          </p>

          <h1 className="mt-2 text-[clamp(28px,4.2vw,58px)] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:mt-3">
            {t("hero.titre")}
            <br />
            {t("hero.titreSuite")}
            <br />
            <span className="text-jaune-vif">{t("hero.titreLieu")}</span>
          </h1>

          <p className="mt-3 max-w-[520px] text-[clamp(14px,1.45vw,20px)] leading-[1.45] text-white/90 sm:mt-4">
            {t("hero.sousTitre")}
          </p>

          <span className="mt-4 block h-[4px] w-[48px] rounded-full bg-jaune-vif sm:mt-5" />
        </div>
      </div>

      {/* carte qui chevauche le bas de la photo, comme sur resuktat.png */}
      <div className="relative z-10 mx-auto -mt-[48px] sm:-mt-[96px] w-[92%] sm:w-[87.5%] max-w-[1260px]">
        <BarreDeRecherche />
      </div>
    </section>
  );
}
