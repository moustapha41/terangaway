"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Bed,
  Car,
  ConciergeBell,
  Info,
  Headphones,
  User,
  UserPlus,
  FileText,
  LogOut,
  X,
} from "lucide-react";
import { Lien } from "@/lib/i18n/lien";
import { retirerLangue } from "@/lib/i18n/chemins";
import { useT } from "@/lib/i18n/contexte";
import { seDeconnecter } from "@/features/compte/actions";
import { Logo } from "./logo";
import { SelecteurLangue } from "./selecteur-langue";

interface MenuHamburgerProps {
  ouvert: boolean;
  surFermer: () => void;
  visiteur?: string;
  declencheurRef: React.RefObject<HTMLButtonElement | null>;
}

const LIENS_NAVIGATION = [
  { cle: "accueil", href: "/", Icone: Home },
  { cle: "logements", href: "/logements", Icone: Bed },
  { cle: "transports", href: "/transports", Icone: Car },
  { cle: "services", href: "/services", Icone: ConciergeBell },
  { cle: "aPropos", href: "/a-propos", Icone: Info },
  { cle: "aide", href: "/aide", Icone: Headphones },
] as const;

export function MenuHamburger({
  ouvert,
  surFermer,
  visiteur,
  declencheurRef,
}: MenuHamburgerProps) {
  const t = useT();
  const chemin = retirerLangue(usePathname());
  const fermetureRef = useRef<HTMLButtonElement>(null);
  const panneauRef = useRef<HTMLDivElement>(null);

  // Verrouillage du défilement d'arrière-plan lorsque le menu est ouvert
  useEffect(() => {
    if (ouvert) {
      const scrollYPrecedent = window.scrollY;
      document.body.style.overflow = "hidden";
      // Focus initial sur le bouton de fermeture
      fermetureRef.current?.focus();

      const surTouche = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          surFermer();
          declencheurRef.current?.focus();
        }
      };

      window.addEventListener("keydown", surTouche);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", surTouche);
        window.scrollTo(0, scrollYPrecedent);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [ouvert, surFermer, declencheurRef]);

  // Fermeture automatique lors d'un changement de route
  useEffect(() => {
    if (ouvert) {
      surFermer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemin]);

  // Fermeture automatique lors d'un redimensionnement vers tablette/desktop (>= 768px)
  useEffect(() => {
    if (!ouvert) return;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const surChangementMedia = (e: MediaQueryListEvent) => {
      if (e.matches) {
        surFermer();
      }
    };
    mediaQuery.addEventListener("change", surChangementMedia);
    return () => mediaQuery.removeEventListener("change", surChangementMedia);
  }, [ouvert, surFermer]);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:hidden">
      {/* Arrière-plan assombri discret */}
      <div
        className="fixed inset-0 bg-nuit/40 backdrop-blur-[2px] transition-opacity"
        onClick={() => {
          surFermer();
          declencheurRef.current?.focus();
        }}
        aria-hidden="true"
      />

      {/* Panneau latéral flyout */}
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("navigation.principale")}
        id="tiroir-navigation"
        className="relative z-10 flex h-full w-full flex-col bg-surface shadow-2xl sm:w-[380px] sm:max-w-[90vw]"
      >
        {/* En-tête du tiroir avec logo et bouton de fermeture */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-contour/50 px-6 pt-[env(safe-area-inset-top)]">
          <Lien
            href="/"
            onClick={surFermer}
            className="flex items-center"
            aria-label={t("commun.nomApplication")}
          >
            <Logo forme="verrou" hauteur={34} prioritaire />
          </Lien>

          <button
            ref={fermetureRef}
            type="button"
            onClick={() => {
              surFermer();
              declencheurRef.current?.focus();
            }}
            aria-label={t("entete.fermerMenu")}
            className="flex h-11 w-11 items-center justify-center rounded-control text-nuit transition-colors hover:bg-champ focus-visible:outline-2 focus-visible:outline-primaire"
          >
            <X className="h-6 w-6 text-nuit" strokeWidth={2} />
          </button>
        </div>

        {/* Corps du menu avec défilement interne */}
        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5 pb-[max(24px,env(safe-area-inset-bottom))]">
          {/* Navigation principale */}
          <nav aria-label={t("navigation.principale")} className="flex flex-col gap-1">
            {LIENS_NAVIGATION.map(({ cle, href, Icone }) => {
              const actif =
                href === "/" ? chemin === "/" : chemin.startsWith(href);

              return (
                <Lien
                  key={cle}
                  href={href}
                  onClick={surFermer}
                  aria-current={actif ? "page" : undefined}
                  className={
                    "flex min-h-[46px] items-center gap-3.5 rounded-card px-4 py-3 text-[15px] transition-colors " +
                    (actif
                      ? "bg-teinte-jaune font-semibold text-nuit shadow-xs"
                      : "font-medium text-nuit/85 hover:bg-champ hover:text-nuit")
                  }
                >
                  <Icone
                    className={`h-5 w-5 shrink-0 ${
                      actif ? "text-nuit" : "text-nuit/75"
                    }`}
                    strokeWidth={actif ? 2.2 : 1.9}
                  />
                  <span>{t(`entete.${cle}`)}</span>
                </Lien>
              );
            })}
          </nav>

          {/* Séparation visuelle */}
          <hr className="my-4 border-contour/70" />

          {/* Sélecteur de langue */}
          <div className="py-1">
            <SelecteurLangue alignement="gauche" />
          </div>

          {/* Section utilisateur / actions */}
          <div className="mt-4 flex flex-col gap-2.5">
            {visiteur ? (
              <>
                {/* Utilisateur connecté */}
                <Lien
                  href="/compte"
                  onClick={surFermer}
                  className={
                    "flex min-h-[46px] items-center gap-3.5 rounded-card px-4 py-3 text-[15px] font-medium text-nuit transition-colors " +
                    (chemin === "/compte" ||
                    (chemin.startsWith("/compte/") &&
                      !chemin.startsWith("/compte/reservations") &&
                      !chemin.startsWith("/compte/demandes"))
                      ? "bg-teinte-jaune font-semibold text-nuit"
                      : "hover:bg-champ")
                  }
                >
                  <User className="h-5 w-5 shrink-0 text-nuit/75" strokeWidth={1.9} />
                  <span>{t("entete.monCompte")}</span>
                </Lien>

                <Lien
                  href="/compte/reservations"
                  onClick={surFermer}
                  className={
                    "flex min-h-[46px] items-center gap-3.5 rounded-card px-4 py-3 text-[15px] font-medium text-nuit transition-colors " +
                    (chemin.startsWith("/compte/reservations") || chemin.startsWith("/mes-demandes")
                      ? "bg-teinte-jaune font-semibold text-nuit"
                      : "hover:bg-champ")
                  }
                >
                  <FileText className="h-5 w-5 shrink-0 text-nuit/75" strokeWidth={1.9} />
                  <span>{t("entete.mesDemandes")}</span>
                </Lien>

                <form action={seDeconnecter} className="w-full pt-1">
                  <button
                    type="submit"
                    className="flex min-h-[46px] w-full items-center gap-3.5 rounded-card px-4 py-3 text-[15px] font-medium text-danger transition-colors hover:bg-teinte-rouge focus-visible:outline-2 focus-visible:outline-danger"
                  >
                    <LogOut className="h-5 w-5 shrink-0 text-danger" strokeWidth={1.9} />
                    <span>{t("client.seDeconnecter")}</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* Visiteur non connecté */}
                <Lien
                  href="/connexion"
                  onClick={surFermer}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-card bg-nuit px-4 text-[14.5px] font-semibold text-white shadow-xs transition-colors hover:bg-nuit-clair focus-visible:outline-2 focus-visible:outline-primaire"
                >
                  <User className="h-5 w-5" strokeWidth={2} />
                  <span>{t("entete.seConnecter")}</span>
                </Lien>

                <Lien
                  href="/inscription"
                  onClick={surFermer}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-card border border-contour-champ bg-surface px-4 text-[14.5px] font-semibold text-nuit transition-colors hover:bg-champ focus-visible:outline-2 focus-visible:outline-primaire"
                >
                  <UserPlus className="h-5 w-5" strokeWidth={2} />
                  <span>{t("entete.creerCompte")}</span>
                </Lien>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
