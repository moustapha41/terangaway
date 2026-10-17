import type { FiltresDemandesAdmin } from "@teranga/contracts";
import { GENRES_DEMANDE, SERVICES_A_LA_DEMANDE, STATUTS_DEMANDE } from "@teranga/contracts";
import { Carte } from "@teranga/ui";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Les filtres de la liste — un formulaire GET, sans JavaScript.
 *
 * Pas d'état, pas de `router.push` : le navigateur sait composer une URL à
 * partir d'un formulaire depuis toujours. L'équipe peut donc filtrer même
 * quand le réseau est mauvais et que le script n'est pas encore chargé, et
 * chaque sélection reste partageable par son URL. Le composant reste donc
 * serveur : il ne part pas dans le navigateur.
 */
export function FiltresDemandes({
  filtres,
  langue,
}: {
  filtres: FiltresDemandesAdmin;
  langue: Langue;
}) {
  const t = traducteurPour(langue);

  return (
    <Carte className="p-5">
      <form method="get" action={`/${langue}/admin/demandes`} className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-petit text-encre">{t("admin.rechercher")}</span>
          <input
            type="search"
            name="recherche"
            defaultValue={filtres.recherche ?? ""}
            className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre outline-none focus:border-primaire"
          />
        </label>

        <Choix nom="statut" libelle={t("admin.statut")} valeur={filtres.statut} vide={t("admin.tousStatuts")}
          options={STATUTS_DEMANDE.map((s) => ({ valeur: s, libelle: t(`statut.${s}`) }))} />

        <Choix nom="genre" libelle={t("admin.parGenre")} valeur={filtres.genre} vide={t("admin.tousGenres")}
          options={GENRES_DEMANDE.map((g) => ({ valeur: g, libelle: t(`admin.genre.${g}`) }))} />

        <Choix nom="service" libelle={t("services.nosServices")} valeur={filtres.service} vide={t("admin.tousServices")}
          options={SERVICES_A_LA_DEMANDE.map((s) => ({ valeur: s, libelle: t(`services.${s}Titre`) }))} />

        <label className="flex flex-col gap-1">
          <span className="text-petit text-encre">{t("admin.du")}</span>
          <input
            type="date"
            name="du"
            defaultValue={filtres.du ?? ""}
            className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre chiffres-tabulaires outline-none focus:border-primaire"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-petit text-encre">{t("admin.au")}</span>
          <input
            type="date"
            name="au"
            defaultValue={filtres.au ?? ""}
            className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre chiffres-tabulaires outline-none focus:border-primaire"
          />
        </label>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="min-h-[var(--size-control)] rounded-control bg-primaire px-4 text-bouton text-white hover:bg-primaire-fonce"
          >
            {t("admin.filtrer")}
          </button>
          <a
            href={`/${langue}/admin/demandes`}
            className="text-petit font-semibold text-encre-douce hover:text-primaire"
          >
            {t("admin.effacer")}
          </a>
        </div>
      </form>
    </Carte>
  );
}

function Choix({
  nom,
  libelle,
  valeur,
  vide,
  options,
}: {
  nom: string;
  libelle: string;
  valeur?: string;
  vide: string;
  options: { valeur: string; libelle: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-petit text-encre">{libelle}</span>
      <select
        name={nom}
        defaultValue={valeur ?? ""}
        className="min-h-[var(--size-control)] rounded-control border border-contour bg-surface px-3 text-petit text-encre outline-none focus:border-primaire"
      >
        <option value="">{vide}</option>
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}
