import { redirect } from "next/navigation";
import { Carte, Icone } from "@teranga/ui";
import { STATUTS_DEMANDE, GENRES_DEMANDE } from "@teranga/contracts";
import { jetonAdmin } from "@/features/admin/session";
import { apiAdminTableauDeBord } from "@/lib/api/administration";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Rendu à la demande, toujours.
 *
 * Sans cette ligne, Next prérend la page au build : le cookie d'équipe est
 * alors absent, la redirection vers la connexion part dans le HTML statique,
 * et le backoffice reste fermé même pour qui a une session valide.
 */
export const dynamic = "force-dynamic";

/**
 * Tableau de bord — ce que l'équipe regarde en arrivant le matin.
 *
 * Trois chiffres d'abord : ce qui est arrivé aujourd'hui, ce qui attend une
 * réponse, ce qui a dépassé son délai. Les répartitions viennent après : elles
 * renseignent, elles n'appellent pas à agir.
 */
export default async function TableauDeBord({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(`/${langue}/admin/connexion`);

  let bord;
  try {
    bord = await apiAdminTableauDeBord(jeton);
  } catch {
    redirect(`/${langue}/admin/connexion`);
  }

  const vedettes = [
    { cle: "aujourdhui", valeur: bord.aujourdhui, icone: "calendrier" as const, lien: "/admin/demandes" },
    { cle: "aTraiter", valeur: bord.aTraiter, icone: "alerte" as const, lien: "/admin/demandes?statut=envoyee" },
    { cle: "enRetard", valeur: bord.enRetard, icone: "horloge" as const, lien: "/admin/demandes?statut=envoyee" },
    { cle: "total", valeur: bord.total, icone: "statistiques" as const, lien: "/admin/demandes" },
  ];

  return (
    <>
      <h1 className="text-titre-1 text-encre">{t("admin.navTableauDeBord")}</h1>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vedettes.map((v) => (
          <li key={v.cle}>
            <Lien href={v.lien}>
              <Carte className="h-full p-5 transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                  <Icone nom={v.icone} taille={20} />
                </span>
                <p className="mt-3 text-[28px] font-bold leading-none text-encre chiffres-tabulaires">
                  {v.valeur}
                </p>
                <p className="mt-1 text-petit text-encre-douce">{t(`admin.${v.cle}`)}</p>
              </Carte>
            </Lien>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Repartition
          titre={t("admin.parStatut")}
          lignes={STATUTS_DEMANDE.map((statut) => ({
            cle: statut,
            libelle: t(`statut.${statut}`),
            valeur: bord.parStatut[statut],
            lien: `/admin/demandes?statut=${statut}`,
          }))}
        />
        <Repartition
          titre={t("admin.parGenre")}
          lignes={GENRES_DEMANDE.map((genre) => ({
            cle: genre,
            libelle: t(`admin.genre.${genre}`),
            valeur: bord.parGenre[genre],
            lien: `/admin/demandes?genre=${genre}`,
          }))}
        />
      </div>
    </>
  );
}

function Repartition({
  titre,
  lignes,
}: {
  titre: string;
  lignes: { cle: string; libelle: string; valeur: number; lien: string }[];
}) {
  const total = Math.max(...lignes.map((l) => l.valeur), 1);

  return (
    <Carte className="p-5">
      <h2 className="text-titre-3 text-encre">{titre}</h2>
      <ul className="mt-4 space-y-3">
        {lignes.map((ligne) => (
          <li key={ligne.cle}>
            <Lien href={ligne.lien} className="block">
              <span className="flex items-baseline justify-between gap-3 text-petit">
                <span className="text-encre">{ligne.libelle}</span>
                <span className="font-semibold text-encre chiffres-tabulaires">{ligne.valeur}</span>
              </span>
              {/* La barre double le chiffre, elle ne le remplace pas : lue
                  seule, une longueur ne dit rien à qui ne voit pas l'écran. */}
              <span aria-hidden="true" className="mt-1 block h-1.5 rounded-pill bg-champ">
                <span
                  className="block h-full rounded-pill bg-primaire"
                  style={{ width: `${Math.round((ligne.valeur / total) * 100)}%` }}
                />
              </span>
            </Lien>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
