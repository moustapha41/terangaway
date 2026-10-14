"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Lien } from "@/lib/i18n/lien";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { retirerLangue } from "@/lib/i18n/chemins";
import { Logo } from "./logo";
import { Avatar } from "@/components/client/barre-laterale";
import { SelecteurLangue } from "./selecteur-langue";

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
  // Le chemin sans son préfixe de langue : l'onglet actif ne dépend pas de /fr ou /es.
  const chemin = retirerLangue(usePathname());

  return (
    <header className="relative z-20 bg-white">
      <div className="mx-auto flex h-16 w-[87.5%] max-w-[1260px] items-center gap-8">
        {/* logo */}
        <Lien href="/" className="flex shrink-0 items-center" aria-label={t("commun.nomApplication")}>
          <Logo hauteur={38} prioritaire />
        </Lien>

        {/* navigation */}
        <nav className="mx-auto hidden items-center gap-7 lg:flex">
          {LIENS.map((lien) => {
            const actif =
              lien.href === "/" ? chemin === "/" : chemin.startsWith(lien.href);
            return (
              <Lien
                key={lien.cle}
                href={lien.href}
                className={
                  actif
                    ? "relative py-1 text-[13.5px] font-semibold text-nuit"
                    : "py-1 text-[13.5px] text-ardoise transition-colors hover:text-nuit"
                }
              >
                <span aria-current={actif ? "page" : undefined}>{t(`entete.${lien.cle}`)}</span>
                {actif && (
                  <span className="absolute -bottom-1.5 left-0 h-[2.5px] w-full rounded-full bg-jaune-vif" />
                )}
              </Lien>
            );
          })}
        </nav>

        {/* langue + connexion */}
        <div className="ml-auto flex shrink-0 items-center gap-7 lg:ml-0">
          {/* `useSearchParams` oblige à une frontière Suspense : sans elle, toute
              page pré-rendue qui porte l'en-tête fait échouer la compilation. */}
          <Suspense fallback={<span className="text-[14px] font-medium uppercase text-nuit">{langue}</span>}>
            <SelecteurLangue />
          </Suspense>

          {/* Connecté, l'en-tête montre qui on est plutôt que d'inviter à se
              connecter — maquette de l'espace client. */}
          {visiteur ? (
            <Lien href="/compte" className="flex items-center gap-2.5">
              <Avatar nom={visiteur} taille={36} />
              <span className="hidden leading-tight sm:block">
                <span className="block text-[13.5px] font-semibold text-nuit">{visiteur}</span>
                <span className="block text-[11px] text-ardoise">{t("client.espace")}</span>
              </span>
            </Lien>
          ) : (
            <Lien
              href="/connexion"
              className="rounded-[10px] bg-nuit px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-nuit-clair"
            >
              {t("entete.seConnecter")}
            </Lien>
          )}
        </div>
      </div>
    </header>
  );
}
