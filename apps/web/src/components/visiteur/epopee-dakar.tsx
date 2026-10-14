"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Award,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  HeartHandshake,
  MapPin,
} from "lucide-react";
import { Lien } from "@/lib/i18n/lien";
import type { Langue } from "@/lib/i18n/langues";
import { useT } from "@/lib/i18n/contexte";
import { FENETRE_JEUX } from "@/lib/dates/sejour";

const POLES = [
  { id: "dakar", disciplines: ["athletisme", "basket3x3", "skateboard", "natation"] },
  { id: "diamniadio", disciplines: ["football", "handball", "basketball", "judo"] },
  { id: "saly", disciplines: ["voile", "beachvolley", "triathlon", "surf"] },
] as const;

/** Clé de catalogue pour un pôle : « dakar » -> « epopee.poleDakar ». */
const clePole = (id: string) => `epopee.pole${id[0].toUpperCase()}${id.slice(1)}`;

/**
 * Section immersive avant le pied de page : les trois pôles des Jeux et le
 * compte à rebours, sur une photo des sites en parallaxe.
 *
 * La parallaxe ne passe **pas** par l'état React. Un `setState` par événement
 * de défilement re-rendait tout le composant — compte à rebours et pôles
 * compris — des dizaines de fois par seconde, et c'est ce qui la faisait
 * saccader. Ici le défilement écrit une variable CSS sur la section, cadencé
 * par `requestAnimationFrame` : le navigateur compose, React ne refait rien.
 *
 * L'avancement est **normalisé sur la traversée de la section** et borné à
 * [0, 1] : l'ancien calcul grandissait sans limite tant qu'on descendait, et
 * l'image finissait par sortir du cadre.
 *
 * Respecte `prefers-reduced-motion`.
 */
export function EpopeeDakar({ langue = "fr" }: { langue?: Langue }) {
  void langue;
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);
  const [poleActif, setPoleActif] = useState<(typeof POLES)[number]["id"]>("dakar");
  const [temps, setTemps] = useState({ jours: 0, heures: 0, minutes: 0, secondes: 0 });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Un changement de réglage repose la section tout de suite, sans recharger.
    const onMedia = () => placer();
    media.addEventListener("change", onMedia);

    // Avancement de la section dans la fenêtre, de 0 (elle entre par le bas)
    // à 1 (elle sort par le haut), écrit tel quel dans une variable CSS.
    let demande = 0;
    const placer = () => {
      demande = 0;
      const section = sectionRef.current;
      if (!section) return;
      // Mouvement réduit : on pose la fin de course. Tout est révélé d'emblée
      // et plus rien ne bouge. (0,5 laisserait le dernier groupe à mi-opacité.)
      if (media.matches) {
        section.style.setProperty("--avance", "1");
        return;
      }
      const piste = section.firstElementChild as HTMLElement | null;
      if (!piste) return;
      const rect = piste.getBoundingClientRect();
      // Course utile : ce qui reste à faire défiler une fois le cadre épinglé.
      const course = rect.height - window.innerHeight;
      const avance = course <= 0 ? 0 : -rect.top / course;
      section.style.setProperty("--avance", String(Math.max(0, Math.min(1, avance))));
    };
    const onScroll = () => {
      // Le défilement peut tirer plus vite qu'une image ; on ne garde que la
      // dernière demande avant le prochain rendu du navigateur.
      if (demande || media.matches) return;
      demande = requestAnimationFrame(placer);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    placer();

    // L'ouverture des Jeux est une donnée du produit, pas de cette section :
    // elle était recopiée ici, et au 31 octobre au lieu du 20.
    const cible = new Date(`${FENETRE_JEUX.debut}T18:00:00Z`).getTime();
    const tick = () => {
      const dist = Math.max(0, cible - Date.now());
      setTemps({
        jours: Math.floor(dist / 86_400_000),
        heures: Math.floor((dist % 86_400_000) / 3_600_000),
        minutes: Math.floor((dist % 3_600_000) / 60_000),
        secondes: Math.floor((dist % 60_000) / 1000),
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);

    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (demande) cancelAnimationFrame(demande);
      window.clearInterval(timer);
    };
  }, []);

  const info = POLES.find((p) => p.id === poleActif) ?? POLES[0];

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-nuit text-white"
      aria-label={t("epopee.etiquette")}
    >
      {/* La piste. Sa hauteur est la distance à parcourir : deux écrans de plus
          que le cadre, soit deux à trois secondes de défilement. Le cadre, lui,
          reste collé en haut pendant toute la traversée.

          `position: sticky` fait l'épinglage tout seul, sans JavaScript : si le
          script ne tourne pas, la section se comporte en bloc ordinaire et tout
          le contenu reste lisible. */}
      <div className="relative h-auto [@media(min-width:1024px)_and_(min-height:960px)]:h-[300vh]">
        <div className="relative overflow-hidden [@media(min-width:1024px)_and_(min-height:960px)]:sticky [@media(min-width:1024px)_and_(min-height:960px)]:top-0 [@media(min-width:1024px)_and_(min-height:960px)]:h-screen">
      {/* La photo des sites, en parallaxe. Elle est débordante en hauteur :
          c'est cette marge que la parallaxe consomme, donc aucun bord ne peut
          entrer dans le cadre, quelle que soit la position de défilement. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-[18%] h-[136%] will-change-transform"
        style={{
          // Un travelling franc : l'image remonte de 180 px et se rapproche de
          // 8 % sur la course. Les 76 px précédents ne se voyaient pas.
          transform:
            "translate3d(0, calc(var(--avance, 0) * -180px), 0) scale(calc(1.08 - var(--avance, 0) * 0.08))",
          transformOrigin: "50% 40%",
        }}
      >
        <Image
          src="/images/sites-jeux.jpg"
          alt=""
          fill
          sizes="100vw"
          quality={82}
          className="object-cover object-center"
        />
      </div>

      {/* Voile de lisibilité. Un seul calque, assez dense à gauche pour que le
          texte blanc tienne le contraste, transparent à droite pour qu'on voie
          la photo. Les deux dégradés précédents, à 40 % et 50 % par-dessus une
          image déjà à 35 %, ne laissaient rien voir du tout. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,18,34,0.94) 0%, rgba(0,20,38,0.88) 38%, rgba(0,22,40,0.66) 66%, rgba(0,24,44,0.46) 100%)",
        }}
      />
      {/* Chaleur en haut à droite, et assise sombre en bas pour le pied de page. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 82% 6%, rgba(244,185,66,0.14) 0%, transparent 56%), linear-gradient(180deg, rgba(0,18,34,0.5) 0%, transparent 26%, transparent 72%, rgba(0,18,34,0.78) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-[87.5%] max-w-[1260px] flex-col justify-center py-14 md:py-16 [@media(min-width:1024px)_and_(min-height:960px)]:h-full [@media(min-width:1024px)_and_(min-height:960px)]:py-6">
        {/* Groupe 1 — le titre, découvert entre 0 et 0,22 d'avancement. */}
        <div className="[@media(min-width:1024px)_and_(min-height:960px)]:[--p:clamp(0,calc(var(--avance,1)/0.12),1)] [@media(min-width:1024px)_and_(min-height:960px)]:opacity-[var(--p,1)] [@media(min-width:1024px)_and_(min-height:960px)]:[transform:translate3d(0,calc((1-var(--p,1))*26px),0)]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jaune-vif">
          {t("epopee.surtitre")}
        </p>
        <h2 className="mt-3 max-w-[720px] [@media(min-width:1024px)_and_(min-height:960px)]:mt-2 text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.12] tracking-[-0.02em]">
          {t("epopee.titre")}
          <span className="mt-1 block text-jaune-vif">{t("epopee.titreSuite")}</span>
        </h2>
        <p className="mt-4 max-w-[560px] [@media(min-width:1024px)_and_(min-height:960px)]:mt-3 text-[15px] leading-relaxed text-[#E6EDF5] md:text-[16px]">
          {t("epopee.chapeau")}
        </p>
        </div>

        {/* Groupe 2 — les chiffres, entre 0,22 et 0,48. */}
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 [@media(min-width:1024px)_and_(min-height:960px)]:mt-6 lg:grid-cols-4 [@media(min-width:1024px)_and_(min-height:960px)]:[--p:clamp(0,calc((var(--avance,1)-0.14)/0.22),1)] [@media(min-width:1024px)_and_(min-height:960px)]:opacity-[var(--p,1)] [@media(min-width:1024px)_and_(min-height:960px)]:[transform:translate3d(0,calc((1-var(--p,1))*30px),0)]">
          {(
            [
              { icone: Flame, cle: "Edition" },
              { icone: Compass, cle: "Poles" },
              { icone: Award, cle: "Disciplines" },
              { icone: HeartHandshake, cle: "Visiteurs" },
            ] as const
          ).map((item) => {
            const Icone = item.icone;
            return (
              <li
                key={item.cle}
                className="rounded-[16px] border border-white/14 bg-[#07182A]/82 p-5 [@media(min-width:1024px)_and_(min-height:960px)]:p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-jaune/15 text-jaune-vif">
                  <Icone strokeWidth={1.7} className="h-5 w-5" />
                </span>
                <p className="mt-4 text-[28px] font-bold tracking-tight text-white">
                  {t(`epopee.chiffre${item.cle}`)}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-white">{t(`epopee.chiffre${item.cle}Titre`)}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-[#D6DFEA]">{t(`epopee.chiffre${item.cle}Texte`)}</p>
              </li>
            );
          })}
        </ul>

        {/* Groupe 3 — les pôles et le compte à rebours, entre 0,48 et 0,78. */}
        <div className="mt-10 grid gap-6 [@media(min-width:1024px)_and_(min-height:960px)]:mt-6 lg:grid-cols-12 lg:gap-8 [@media(min-width:1024px)_and_(min-height:960px)]:[--p:clamp(0,calc((var(--avance,1)-0.38)/0.24),1)] [@media(min-width:1024px)_and_(min-height:960px)]:opacity-[var(--p,1)] [@media(min-width:1024px)_and_(min-height:960px)]:[transform:translate3d(0,calc((1-var(--p,1))*34px),0)]">
          <div className="rounded-[18px] border border-white/14 bg-[#07182A]/82 p-5 md:p-7 [@media(min-width:1024px)_and_(min-height:960px)]:p-5 lg:col-span-7">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-jaune-vif">
              {t("epopee.sitesOfficiels")}
            </p>
            <h3 className="mt-2 text-[22px] font-bold text-white">
              {t("epopee.ouVivrez")}
            </h3>

            <div className="mt-5 flex flex-wrap gap-2">
              {POLES.map((pole) => (
                <button
                  key={pole.id}
                  type="button"
                  onClick={() => setPoleActif(pole.id)}
                  aria-pressed={poleActif === pole.id}
                  className={
                    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-colors " +
                    (poleActif === pole.id
                      ? "bg-jaune text-nuit"
                      : "border border-white/15 bg-transparent text-[#E6EDF5] hover:bg-[#07182A]/95 hover:text-white")
                  }
                >
                  <MapPin strokeWidth={1.8} className="h-3.5 w-3.5" />
                  {t(`epopee.surnom${pole.id[0].toUpperCase()}${pole.id.slice(1)}`)}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[14px] border border-white/14 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-[16px] font-bold text-white">{t(clePole(info.id))}</p>
                <span className="text-[12.5px] text-[#D6DFEA]">{t(`${clePole(info.id)}Acces`)}</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#E6EDF5]">
                {t(`${clePole(info.id)}Texte`)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {info.disciplines.map((d) => (
                  <span
                    key={d}
                    className="rounded-lg bg-[#07182A]/95 px-2.5 py-1 text-[12px] text-[#F2F6FA]"
                  >
                    {t(`epopee.discipline.${d}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[18px] border border-jaune/30 bg-[#07182A]/95 p-5 md:p-7 [@media(min-width:1024px)_and_(min-height:960px)]:p-5 lg:col-span-5">
            <div>
              <div className="flex items-center gap-2 text-jaune-vif">
                <Clock strokeWidth={1.7} className="h-4 w-4" />
                <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em]">
                  {t("epopee.compteARebours")}
                </span>
              </div>
              <p className="mt-2 text-[14px] text-[#E6EDF5]">
                {t("epopee.compteAReboursTexte")}
              </p>

              <div className="mt-6 [@media(min-width:1024px)_and_(min-height:960px)]:mt-4 grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    { v: temps.jours, l: "Jours" },
                    { v: temps.heures, l: "Heures" },
                    { v: temps.minutes, l: "Min" },
                    { v: temps.secondes, l: "Sec" },
                  ] as const
                ).map((b) => (
                  <div
                    key={b.l}
                    className="rounded-xl border border-white/14 bg-black/45 px-1 py-3"
                  >
                    <span className="block text-[24px] font-bold text-white chiffres-tabulaires md:text-[28px]">
                      {b.v}
                    </span>
                    <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-[#C3CEDC]">
                      {b.l}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Lien
                href="/logements"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-jaune py-3.5 text-[15px] font-bold text-nuit transition-colors hover:bg-jaune-vif"
              >
                {t("epopee.trouverLogement")}
                <ChevronRight strokeWidth={2} className="h-4 w-4" />
              </Lien>
              <Lien
                href="/transports"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#07182A]/95"
              >
                {t("epopee.reserverTransport")}
              </Lien>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </section>
  );
}
