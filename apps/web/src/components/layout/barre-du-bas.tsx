"use client";

import { usePathname } from "next/navigation";
import { Icone, type NomIcone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { retirerLangue } from "@/lib/i18n/chemins";
import { useT } from "@/lib/i18n/contexte";

/**
 * Barre du bas — « un en-tête et une barre du bas à trois entrées ; rien d'autre
 * n'est ajouté tant que la V1 n'a que deux services » (§B.6).
 *
 * Icône **et** mot sur chaque entrée. Une pastille signale une demande qui
 * attend une action du visiteur ; sans elle, une demande acceptée se perd et
 * finit par expirer.
 *
 * Elle disparaît sur les écrans qui portent une barre d'action — fiche et
 * formulaire de demande. Le dossier est formel : un seul élément fixe en bas
 * d'écran, sinon les deux se disputent le pouce.
 */
const ENTREES: { cle: "accueil" | "mesDemandes" | "aide"; href: string; icone: NomIcone }[] = [
  { cle: "accueil", href: "/", icone: "logement" },
  { cle: "mesDemandes", href: "/mes-demandes", icone: "calendrier" },
  { cle: "aide", href: "/aide", icone: "assistance" },
];

/** Écrans dont la barre d'action remplace la barre du bas. */
const AVEC_BARRE_ACTION = [/^\/logements\/[^/]+$/, /^\/transports\/[^/]+$/, /^\/demande\/[^/]+$/];

export function BarreDuBas({ enAttente = 0 }: { enAttente?: number }) {
  const t = useT();
  const chemin = retirerLangue(usePathname());

  if (AVEC_BARRE_ACTION.some((motif) => motif.test(chemin))) return null;

  return (
    <nav
      aria-label={t("navigation.principale")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-contour bg-surface lg:hidden"
    >
      <ul className="mx-auto flex max-w-[560px]">
        {ENTREES.map((entree) => {
          const actif = entree.href === "/" ? chemin === "/" : chemin.startsWith(entree.href);
          const pastille = entree.cle === "mesDemandes" && enAttente > 0;

          return (
            <li key={entree.cle} className="flex-1">
              <Lien
                href={entree.href}
                aria-current={actif ? "page" : undefined}
                className={
                  "relative flex min-h-[var(--size-touch)] flex-col items-center justify-center gap-0.5 py-2 " +
                  (actif ? "text-primaire" : "text-encre-douce")
                }
              >
                <span className="relative">
                  <Icone nom={entree.icone} taille={24} />
                  {pastille && (
                    <span
                      className="absolute -right-1.5 -top-1 min-w-[18px] rounded-pill bg-danger px-1 text-center text-[11px] font-semibold leading-[18px] text-white chiffres-tabulaires"
                      aria-hidden="true"
                    >
                      {enAttente}
                    </span>
                  )}
                </span>
                <span className={`text-legende ${actif ? "font-semibold" : ""}`}>
                  {t(`navigation.${entree.cle}`)}
                </span>
                {/* La pastille est décorative : le compte est dit en toutes lettres. */}
                {pastille && (
                  <span className="sr-only">
                    {t("navigation.enAttente", { nombre: enAttente })}
                  </span>
                )}
              </Lien>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
