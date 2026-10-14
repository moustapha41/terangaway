"use client";

import { usePathname } from "next/navigation";
import { Icone, type NomIcone } from "@teranga/ui";
import { seDeconnecter } from "@/features/prestataire/actions";
import { Lien } from "@/lib/i18n/lien";
import { retirerLangue } from "@/lib/i18n/chemins";
import { useT } from "@/lib/i18n/contexte";

/**
 * Colonne de navigation de l'espace prestataire — maquette du collage, écran 5.
 *
 * Dix entrées : une barre horizontale les faisait déborder dès 1250 px. En
 * colonne elles tiennent toutes, et sous `lg` elles redeviennent une bande
 * défilante où seules les icônes restent.
 */
const ENTREES: { cle: string; href: string; icone: NomIcone }[] = [
  { cle: "tableauDeBord", href: "/prestataire", icone: "information" },
  { cle: "mesServices", href: "/prestataire/offres", icone: "logement" },
  { cle: "mesDemandes", href: "/prestataire/demandes", icone: "calendrier" },
  { cle: "reservations", href: "/prestataire/reservations", icone: "coche-cercle" },
  { cle: "calendrier", href: "/prestataire/calendrier", icone: "calendrier" },
  { cle: "messages", href: "/prestataire/messages", icone: "whatsapp" },
  { cle: "avis", href: "/prestataire/avis", icone: "verification" },
  { cle: "statistiques", href: "/prestataire/statistiques", icone: "tri" },
  { cle: "monProfil", href: "/prestataire/profil", icone: "personnes" },
  { cle: "parametres", href: "/prestataire/parametres", icone: "filtre" },
];

export function ColonnePrestataire({ nom }: { nom: string }) {
  const t = useT();
  const chemin = retirerLangue(usePathname());

  return (
    <nav aria-label={t("prestataire.espace")} className="lg:sticky lg:top-6">
      <ul className="flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
        {ENTREES.map((entree) => {
          const actif =
            entree.href === "/prestataire"
              ? chemin === "/prestataire"
              : chemin.startsWith(entree.href);
          return (
            <li key={entree.cle} className="shrink-0">
              <Lien
                href={entree.href}
                aria-current={actif ? "page" : undefined}
                className={
                  "flex min-h-[var(--size-control)] items-center gap-3 rounded-control px-4 text-petit transition-colors " +
                  (actif
                    ? "bg-primaire font-semibold text-white"
                    : "text-encre-douce hover:bg-champ hover:text-encre")
                }
              >
                <Icone nom={entree.icone} taille={20} />
                <span className="hidden lg:inline">{t(`prestataire.${entree.cle}`)}</span>
              </Lien>
            </li>
          );
        })}
      </ul>

      <form action={seDeconnecter} className="mt-5 hidden lg:block">
        <button
          type="submit"
          className="flex min-h-[var(--size-touch)] items-center gap-3 rounded-control px-4 text-petit font-semibold text-danger transition-colors hover:bg-teinte-rouge"
        >
          <Icone nom="retour" taille={20} />
          {t("prestataire.seDeconnecter")}
        </button>
      </form>

      <p className="mt-4 hidden text-legende text-encre-douce lg:block">{nom}</p>
    </nav>
  );
}
