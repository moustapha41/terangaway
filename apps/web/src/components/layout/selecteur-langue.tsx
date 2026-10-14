"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icone } from "@teranga/ui";
import { LANGUES, NOMS_LANGUE } from "@/lib/i18n/langues";
import { avecLangue, retirerLangue } from "@/lib/i18n/chemins";
import { useLangue, useT } from "@/lib/i18n/contexte";

/**
 * Sélecteur de langue.
 *
 * Trois **liens**, pas trois boutons : chaque langue mène à la même page dans
 * cette langue, avec le chemin et les paramètres conservés. C'est ce qui réalise
 * la règle du §B.8 — « l'écran se recharge dans la nouvelle langue sans perdre
 * la saisie » — puisque la saisie vit dans l'URL.
 *
 * Bâti sur `<details>` : l'ouverture, la fermeture par Échap et le pliage au
 * clavier viennent du navigateur.
 */
export function SelecteurLangue({ className }: { className?: string }) {
  const t = useT();
  const langue = useLangue();
  const chemin = retirerLangue(usePathname());
  const parametres = useSearchParams().toString();
  const suffixe = parametres ? `?${parametres}` : "";

  return (
    <details className={`relative ${className ?? ""}`}>
      <summary
        aria-label={t("navigation.langueActuelle", { langue: NOMS_LANGUE[langue] })}
        className="flex min-h-[var(--size-touch)] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium uppercase text-nuit"
      >
        <Globe />
        {langue}
        <Icone nom="chevron" taille={16} />
      </summary>

      <ul className="absolute right-0 top-full z-40 mt-2 min-w-[180px] overflow-hidden rounded-card border border-contour bg-surface py-1 shadow-[0_12px_32px_-12px_rgb(2_20_38/0.25)]">
        {LANGUES.map((autre) => (
          <li key={autre}>
            <Link
              href={`${avecLangue(autre, chemin)}${suffixe}`}
              hrefLang={autre}
              aria-current={autre === langue ? "true" : undefined}
              className={
                "flex min-h-[var(--size-touch)] items-center gap-2 px-4 text-petit " +
                (autre === langue ? "font-semibold text-primaire" : "text-encre hover:bg-champ")
              }
            >
              {autre === langue && <Icone nom="coche-cercle" taille={16} />}
              <span className={autre === langue ? "" : "ml-6"}>{NOMS_LANGUE[autre]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Le globe du jeu d'icônes n'existe pas : celui-ci lui est propre. */
function Globe() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </svg>
  );
}
