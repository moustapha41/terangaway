import { redirect } from "next/navigation";
import { BadgeStatut, Carte, Icone } from "@teranga/ui";
import type { FiltresDemandesAdmin } from "@teranga/contracts";
import { FiltresDemandes } from "@/features/admin/filtres-demandes";
import { jetonAdmin } from "@/features/admin/session";
import { apiAdminDemandes, parametresFiltres } from "@/lib/api/administration";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterDateHeure } from "@/features/admin/format";

/**
 * Rendu à la demande, toujours.
 *
 * Sans cette ligne, Next prérend la page au build : le cookie d'équipe est
 * alors absent, la redirection vers la connexion part dans le HTML statique,
 * et le backoffice reste fermé même pour qui a une session valide.
 */
export const dynamic = "force-dynamic";

/**
 * Les demandes reçues.
 *
 * Les filtres vivent dans l'URL, pas dans un état de composant : une sélection
 * se partage par courriel, se met en favori et survit au rechargement. C'est
 * aussi ce qui permet à l'export CSV de porter exactement les mêmes filtres
 * que la liste affichée — un lien, pas une seconde implémentation.
 */
export default async function DemandesAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const requete = await searchParams;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(`/${langue}/admin/connexion`);

  const filtres = lireFiltres(requete);

  let page;
  try {
    page = await apiAdminDemandes(jeton, filtres);
  } catch {
    redirect(`/${langue}/admin/connexion`);
  }

  const pages = Math.max(1, Math.ceil(page.total / page.parPage));
  const lien = (numero: number) =>
    `/admin/demandes?${parametresFiltres({ ...filtres, page: numero })}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-titre-1 text-encre">{t("admin.demandesTitre")}</h1>
        <a
          href={`/${langue}/admin/demandes/export?${parametresFiltres({ ...filtres, page: undefined, parPage: undefined })}`}
          className="inline-flex min-h-[var(--size-control)] items-center gap-2 rounded-control border border-contour bg-surface px-4 text-bouton text-encre hover:border-primaire"
        >
          <Icone nom="statistiques" taille={16} />
          {t("admin.exporter")}
        </a>
      </div>

      <div className="mt-5">
        <FiltresDemandes filtres={filtres} langue={langue} />
      </div>

      <p className="mt-5 text-petit text-encre-douce">
        {t("admin.resultats", { nombre: page.total })}
      </p>

      {page.demandes.length === 0 ? (
        <Carte className="mt-4 p-6">
          <p className="text-petit text-encre-douce">{t("admin.aucune")}</p>
        </Carte>
      ) : (
        <ul className="mt-4 space-y-3">
          {page.demandes.map((demande) => (
            <li key={demande.id}>
              <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                <Lien
                  href={`/admin/demandes/${demande.id}`}
                  className="flex flex-wrap items-center gap-4 p-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <BadgeStatut
                        statut={demande.statut}
                        libelle={t(`statut.${demande.statut}`)}
                      />
                      <span className="rounded-pill bg-champ px-2.5 py-1 text-legende font-semibold text-encre-douce">
                        {t(`admin.genre.${demande.genre}`)}
                      </span>
                      <span className="text-legende text-encre-douce chiffres-tabulaires">
                        {demande.reference}
                      </span>
                    </span>

                    <span className="mt-2 block truncate text-titre-3 text-encre">
                      {demande.service
                        ? t(`services.${demande.service.cle}Titre`)
                        : demande.offre.titre}
                    </span>

                    <span className="mt-1 block text-petit text-encre-douce">
                      {[
                        demande.visiteur.nom,
                        demande.visiteur.email,
                        demande.visiteur.telephone,
                      ]
                        .filter(Boolean)
                        .join(" · ") || demande.visiteur.id}
                    </span>
                  </span>

                  <span className="text-petit text-encre-douce chiffres-tabulaires">
                    {formaterDateHeure(demande.creeLe, langue)}
                  </span>
                  <Icone nom="chevron-droite" taille={20} className="shrink-0 text-encre-douce" />
                </Lien>
              </Carte>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between gap-4">
          {page.page > 1 ? (
            <Lien
              href={lien(page.page - 1)}
              className="text-petit font-semibold text-primaire hover:underline"
            >
              {t("admin.precedente")}
            </Lien>
          ) : (
            <span />
          )}
          <span className="text-petit text-encre-douce chiffres-tabulaires">
            {t("admin.pagination", { page: page.page, pages })}
          </span>
          {page.page < pages ? (
            <Lien
              href={lien(page.page + 1)}
              className="text-petit font-semibold text-primaire hover:underline"
            >
              {t("admin.suivante")}
            </Lien>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

/** Une valeur de requête, ramenée à une chaîne simple. */
function texte(valeur: string | string[] | undefined): string | undefined {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  return brut?.trim() || undefined;
}

/**
 * Les filtres de l'URL.
 *
 * Aucun contrôle de validité ici : c'est l'API qui décide de ce qu'elle
 * accepte, et elle ignore ce qu'elle ne connaît pas. Valider deux fois, c'est
 * se garantir deux listes de valeurs qui finiront par différer.
 */
function lireFiltres(requete: Record<string, string | string[] | undefined>): FiltresDemandesAdmin {
  const page = Number(texte(requete.page));
  return {
    statut: texte(requete.statut) as FiltresDemandesAdmin["statut"],
    genre: texte(requete.genre) as FiltresDemandesAdmin["genre"],
    service: texte(requete.service) as FiltresDemandesAdmin["service"],
    recherche: texte(requete.recherche),
    du: texte(requete.du),
    au: texte(requete.au),
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}
