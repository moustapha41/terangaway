"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useT } from "@/lib/i18n/contexte";

/** Durée d'affichage d'une vue, puis durée du fondu, en millisecondes. */
const PAUSE = 5500;
const FONDU = 1100;

const VUES = [
  { fichier: "hero-appartement.jpg", cleAlt: "heroAltAppartement", cadrage: "object-[center_55%]" },
  { fichier: "hero-transfert.jpg", cleAlt: "heroAltTransfert", cadrage: "object-[70%_center]" },
  { fichier: "hero-guide.jpg", cleAlt: "heroAltGuide", cadrage: "object-[65%_40%]" },
  { fichier: "hero-residence.jpg", cleAlt: "heroAltResidence", cadrage: "object-[70%_center]" },
  { fichier: "hero-voiture.jpg", cleAlt: "heroAltVoiture", cadrage: "object-[70%_center]" },
] as const;

/**
 * Fond défilant du hero des services : les vues se succèdent en fondu enchaîné.
 *
 * Seule la première vue est posée au rendu initial — avec `priority`, c'est
 * elle la plus grande image de l'écran. Les suivantes ne sont montées qu'après
 * la première peinture : à opacité nulle mais dans le cadre, le navigateur les
 * téléchargerait toutes d'emblée et retarderait d'autant celle qu'on regarde.
 *
 * Le défilement s'arrête quand l'onglet passe à l'arrière-plan, et ne démarre
 * pas du tout si le visiteur a demandé un mouvement réduit ; les pastilles
 * restent utilisables dans tous les cas.
 *
 * `quality={92}` plutôt que les 75 par défaut : les sources ne font que
 * 735 px de large et le cadre les étire déjà sur toute la largeur de l'écran.
 * Une recompression à 75 par-dessus cet agrandissement se voit tout de suite
 * sur les aplats — murs, ciel, carrosseries. Des sources plus larges
 * (1600 px et plus) feraient mieux que n'importe quel réglage ici.
 */
export function CarrouselHero() {
  const t = useT();
  const [vue, setVue] = useState(0);
  const [complet, setComplet] = useState(false);
  const [anime, setAnime] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lire = () => setAnime(!media.matches);
    lire();
    media.addEventListener("change", lire);

    // Après la première peinture : on monte le reste du jeu d'images.
    const amorce = window.setTimeout(() => setComplet(true), 600);

    return () => {
      media.removeEventListener("change", lire);
      window.clearTimeout(amorce);
    };
  }, []);

  useEffect(() => {
    if (!anime || !complet) return;
    const minuterie = window.setInterval(() => {
      // Onglet en arrière-plan : on laisse la vue en place plutôt que de
      // dérouler le carrousel dans le vide.
      if (document.hidden) return;
      setVue((actuelle) => (actuelle + 1) % VUES.length);
    }, PAUSE);
    return () => window.clearInterval(minuterie);
  }, [anime, complet]);

  const aller = useCallback((index: number) => setVue(index), []);

  return (
    <>
      {VUES.map((element, index) => {
        if (index > 0 && !complet) return null;
        return (
          <Image
            key={element.fichier}
            src={`/images/services/${element.fichier}`}
            alt={index === vue ? t(`services.${element.cleAlt}`) : ""}
            fill
            priority={index === 0}
            sizes="100vw"
            quality={92}
            aria-hidden={index === vue ? undefined : true}
            style={{ transitionDuration: `${FONDU}ms` }}
            className={`object-cover ${element.cadrage} transition-opacity motion-reduce:transition-none ${
              index === vue ? "opacity-100" : "opacity-0"
            }`}
          />
        );
      })}

      {/* pastilles de navigation, en bas à droite du cadre */}
      <div className="absolute bottom-16 right-[4%] z-10 flex gap-2 sm:bottom-20">
        {VUES.map((element, index) => (
          <button
            key={element.fichier}
            type="button"
            onClick={() => aller(index)}
            aria-label={t("services.heroVue", { position: String(index + 1) })}
            aria-current={index === vue ? "true" : undefined}
            className={`h-2 rounded-pill transition-all ${
              index === vue ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </>
  );
}
