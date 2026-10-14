"use client";

import { usePathname } from "next/navigation";
import { Icone, type NomIcone } from "@teranga/ui";
import { seDeconnecter } from "@/features/compte/actions";
import { Lien } from "@/lib/i18n/lien";
import { retirerLangue } from "@/lib/i18n/chemins";
import { useT } from "@/lib/i18n/contexte";

/**
 * Navigation de l'espace client — maquette du tableau de bord.
 *
 * Colonne fixe à partir de `lg`, repliée en liste au-dessus du contenu en
 * dessous : sur téléphone, la barre du bas du produit reste la navigation
 * principale (§B.6), et dupliquer huit entrées en haut d'écran la noierait.
 */
const ENTREES: { cle: string; href: string; icone: NomIcone }[] = [
  { cle: "tableauDeBord", href: "/compte", icone: "logement" },
  { cle: "mesReservations", href: "/compte/reservations", icone: "calendrier" },
  { cle: "mesDemandes", href: "/compte/demandes", icone: "information" },
  { cle: "mesFavoris", href: "/compte/favoris", icone: "verification" },
  { cle: "messages", href: "/compte/messages", icone: "whatsapp" },
  { cle: "monProfil", href: "/compte/profil", icone: "personnes" },
  { cle: "parametres", href: "/compte/parametres", icone: "filtre" },
  { cle: "aide", href: "/aide", icone: "assistance" },
];

export function BarreLaterale({ nom }: { nom: string }) {
  const t = useT();
  const chemin = retirerLangue(usePathname());

  return (
    <nav aria-label={t("client.espace")} className="lg:sticky lg:top-6">
      <div className="mb-5 flex items-center gap-3">
        <Avatar nom={nom} />
        <div className="min-w-0">
          <p className="truncate text-titre-3 text-encre">{nom}</p>
          <p className="text-petit text-encre-douce">{t("client.espace")}</p>
        </div>
      </div>

      <ul className="space-y-1">
        {ENTREES.map((entree) => {
          const actif =
            entree.href === "/compte" ? chemin === "/compte" : chemin.startsWith(entree.href);
          return (
            <li key={entree.cle}>
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
                {t(`client.${entree.cle}`)}
              </Lien>
            </li>
          );
        })}
      </ul>

      <form action={seDeconnecter} className="mt-6">
        <button
          type="submit"
          className="flex min-h-[var(--size-touch)] items-center gap-3 rounded-control px-4 text-petit font-semibold text-danger transition-colors hover:bg-teinte-rouge"
        >
          <Icone nom="retour" taille={20} />
          {t("client.seDeconnecter")}
        </button>
      </form>
    </nav>
  );
}

/**
 * Avatar en initiales.
 *
 * Pas de photo : le §A.7 interdit toute personne reconnaissable sans accord
 * écrit, et une photo de profil par défaut serait une personne inventée.
 */
export function Avatar({ nom, taille = 44 }: { nom: string; taille?: number }) {
  const initiales = nom
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((mot) => mot[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      style={{ width: taille, height: taille }}
      className="flex shrink-0 items-center justify-center rounded-pill bg-teinte-bleu font-semibold text-primaire"
    >
      {initiales}
    </span>
  );
}
