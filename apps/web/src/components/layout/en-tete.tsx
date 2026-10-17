"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Lien } from "@/lib/i18n/lien";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { retirerLangue } from "@/lib/i18n/chemins";
import { obtenirVisiteurConnecteNom } from "@/features/compte/actions";
import { Logo } from "./logo";
import { Avatar } from "@/components/client/barre-laterale";
import { SelecteurLangue } from "./selecteur-langue";
import { MenuHamburger } from "./menu-hamburger";

const LIENS = [
  { cle: "accueil", href: "/" },
  { cle: "logements", href: "/logements" },
  { cle: "transports", href: "/transports" },
  { cle: "aPropos", href: "/a-propos" },
  { cle: "aide", href: "/aide" },
] as const;

export function EnTete({ visiteur }: { visiteur?: string } = {}) {
  const t = useT();
  const langue = useLangue();
  const pathname = usePathname();
  const chemin = retirerLangue(pathname);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [nomVisiteur, setNomVisiteur] = useState<string | undefined>(visiteur);
  const declencheurRef = useRef<HTMLButtonElement>(null);

  // Synchronisation de l'identité du visiteur si transmise ou résolue côté client
  useEffect(() => {
    if (visiteur) {
      setNomVisiteur(visiteur);
    } else {
      obtenirVisiteurConnecteNom().then((nom) => {
        if (nom) setNomVisiteur(nom);
      });
    }
  }, [visiteur]);

  return (
    <header className="relative z-20 bg-white border-b border-contour/30 sm:border-transparent">
      <div className="mx-auto flex h-16 w-[92%] md:w-[94%] lg:w-[87.5%] max-w-[1260px] items-center justify-between gap-3 md:gap-4 lg:gap-8">
        {/* Logo Teranga Way */}
        <Lien href="/" className="flex shrink-0 items-center" aria-label={t("commun.nomApplication")}>
          <span className="md:hidden">
            <Logo forme="verrou" hauteur={28} prioritaire />
          </span>
          <span className="hidden md:inline-flex lg:hidden">
            <Logo forme="verrou" hauteur={32} prioritaire />
          </span>
          <span className="hidden lg:inline-flex">
            <Logo forme="verrou" hauteur={38} prioritaire />
          </span>
        </Lien>

        {/* Navigation classique (visible sur tablette et ordinateur >= 768 px) */}
        <nav
          className="hidden md:flex items-center gap-3.5 lg:gap-7"
          aria-label={t("navigation.principale")}
        >
          {LIENS.map((lien) => {
            const actif =
              lien.href === "/" ? chemin === "/" : chemin.startsWith(lien.href);
            return (
              <Lien
                key={lien.cle}
                href={lien.href}
                className={
                  actif
                    ? "relative py-1 text-[13px] lg:text-[13.5px] font-semibold text-nuit shrink-0"
                    : "py-1 text-[13px] lg:text-[13.5px] text-ardoise transition-colors hover:text-nuit shrink-0"
                }
              >
                <span aria-current={actif ? "page" : undefined}>
                  {t(`entete.${lien.cle}`)}
                </span>
                {actif && (
                  <span className="absolute -bottom-1.5 left-0 h-[2.5px] w-full rounded-full bg-jaune-vif" />
                )}
              </Lien>
            );
          })}
        </nav>

        {/* Section droite : Sélecteur de langue + Connexion/Compte (>= 768px) + Hamburger (< 768px) */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5 md:gap-3.5 lg:gap-5">
          {/* Sélecteur de langue (toujours présent) */}
          <Suspense fallback={<span className="text-[14px] font-medium uppercase text-nuit">{langue}</span>}>
            <SelecteurLangue />
          </Suspense>

          {/* Connexion / Espace client (affiché sur tablette et ordinateur >= 768 px) */}
          {nomVisiteur ? (
            <Lien href="/compte" className="hidden md:flex items-center gap-2 sm:gap-2.5">
              <Avatar nom={nomVisiteur} taille={34} />
              <span className="hidden leading-tight lg:block">
                <span className="block text-[13.5px] font-semibold text-nuit truncate max-w-[140px]">
                  {nomVisiteur}
                </span>
                <span className="block text-[11px] text-ardoise">{t("client.espace")}</span>
              </span>
            </Lien>
          ) : (
            <Lien
              href="/connexion"
              className="hidden md:inline-flex rounded-[10px] bg-nuit px-3.5 py-2 lg:px-5 lg:py-2.5 text-[13px] lg:text-[13.5px] font-semibold text-white transition-colors hover:bg-nuit-clair shrink-0"
            >
              {t("entete.seConnecter")}
            </Lien>
          )}

          {/* Bouton Hamburger mobile (< 768 px uniquement) */}
          <button
            ref={declencheurRef}
            type="button"
            onClick={() => setMenuOuvert(true)}
            aria-expanded={menuOuvert}
            aria-controls="tiroir-navigation"
            aria-label={t("entete.ouvrirMenu")}
            className="flex md:hidden h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] border border-bordure bg-white text-nuit shadow-2xs transition-colors hover:bg-champ hover:border-nuit/30 focus-visible:outline-2 focus-visible:outline-primaire active:scale-95"
          >
            <Menu className="h-6 w-6 text-nuit" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Tiroir flyout modal accessible pour mobile */}
      <MenuHamburger
        ouvert={menuOuvert}
        surFermer={() => setMenuOuvert(false)}
        visiteur={nomVisiteur}
        declencheurRef={declencheurRef}
      />
    </header>
  );
}
