import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Download,
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  User,
  Calendar,
  Inbox,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { FiltresDemandesAdmin, StatutDemande } from "@teranga/contracts";
import { FiltresDemandes } from "@/features/admin/filtres-demandes";
import { ServeurInjoignable } from "@/features/admin/serveur-injoignable";
import { jetonAdmin, urlConnexionAdmin } from "@/features/admin/session";
import { apiAdminDemandes, parametresFiltres } from "@/lib/api/administration";
import { ErreurApi } from "@/lib/api/http";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterDateHeure } from "@/features/admin/format";
import { avecLangue } from "@/lib/i18n/chemins";
import { formaterPrix } from "@/lib/prix";

export const dynamic = "force-dynamic";

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
  if (!jeton) redirect(urlConnexionAdmin(langue));

  const filtres = lireFiltres(requete);

  let page;
  try {
    page = await apiAdminDemandes(jeton, filtres);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.statut === 401 || erreur.statut === 403)) {
      redirect(urlConnexionAdmin(langue));
    }
    return <ServeurInjoignable langue={langue} />;
  }

  const pages = Math.max(1, Math.ceil(page.total / page.parPage));
  const lien = (numero: number) =>
    avecLangue(langue, `/admin/demandes?${parametresFiltres({ ...filtres, page: numero })}`);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("admin.demandesTitre")}
            </h1>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
              {t("admin.resultats", { nombre: page.total })}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Consultez, assignez et traitez les réservations en temps réel.
          </p>
        </div>

        <a
          href={`/${langue}/admin/demandes/export?${parametresFiltres({ ...filtres, page: undefined, parPage: undefined })}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <Download className="h-4 w-4 text-slate-500" />
          <span>{t("admin.exporter")}</span>
        </a>
      </div>

      {/* Filtres de recherche */}
      <FiltresDemandes filtres={filtres} langue={langue} total={page.total} />

      {/* Liste des demandes / Tableau */}
      {page.demandes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Inbox className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">{t("admin.aucune")}</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            Aucune demande ne correspond à vos critères de filtrage. Essayez d&apos;élargir vos filtres ou de réinitialiser la recherche.
          </p>
          <Link
            href={avecLangue(langue, "/admin/demandes")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            {t("admin.effacer")}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Table pour Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-4">Réf & Date</th>
                  <th scope="col" className="px-6 py-4">Visiteur</th>
                  <th scope="col" className="px-6 py-4">Prestation</th>
                  <th scope="col" className="px-6 py-4">Statut</th>
                  <th scope="col" className="px-6 py-4">Montant</th>
                  <th scope="col" className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.demandes.map((demande) => {
                  const urlDetail = avecLangue(langue, `/admin/demandes/${demande.id}`);
                  const titre = demande.service
                    ? t(`services.${demande.service.cle}Titre`)
                    : demande.offre.titre;

                  return (
                    <tr
                      key={demande.id}
                      className="group transition-colors hover:bg-slate-50/80 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={urlDetail} className="block">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-[#001D35]">
                            {demande.reference}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formaterDateHeure(demande.creeLe, langue)}
                          </span>
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <Link href={urlDetail} className="block">
                          <span className="font-semibold text-slate-800 block">
                            {demande.visiteur.nom || "Visiteur"}
                          </span>
                          <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-slate-400">
                            {demande.visiteur.email && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <Mail className="h-3 w-3 shrink-0" />
                                {demande.visiteur.email}
                              </span>
                            )}
                            {demande.visiteur.telephone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                {demande.visiteur.telephone}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <Link href={urlDetail} className="block max-w-xs">
                          <span className="line-clamp-1 font-medium text-slate-900 group-hover:text-[#001D35]">
                            {titre}
                          </span>
                          <span className="mt-1 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {t(`admin.genre.${demande.genre}`)}
                          </span>
                        </Link>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={urlDetail} className="block">
                          <BadgeStatutModernise statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
                        </Link>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-slate-900">
                        <Link href={urlDetail} className="block">
                          {demande.prix.total > 0 ? (
                            <span>{formaterPrix(demande.prix.total, langue)}</span>
                          ) : (
                            <span className="text-slate-400 text-xs font-sans font-normal italic">
                              {t("admin.surDevis")}
                            </span>
                          )}
                        </Link>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={urlDetail}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition group-hover:border-slate-300 group-hover:bg-[#001D35] group-hover:text-white"
                        >
                          <span>Dossier</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vue Mobile / Tablette en cartes */}
          <div className="divide-y divide-slate-100 lg:hidden">
            {page.demandes.map((demande) => {
              const urlDetail = avecLangue(langue, `/admin/demandes/${demande.id}`);
              const titre = demande.service
                ? t(`services.${demande.service.cle}Titre`)
                : demande.offre.titre;

              return (
                <Link
                  key={demande.id}
                  href={urlDetail}
                  className="block p-4 transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {demande.reference}
                    </span>
                    <BadgeStatutModernise statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
                  </div>

                  <h4 className="mt-2 text-sm font-semibold text-slate-900 line-clamp-1">
                    {titre}
                  </h4>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{demande.visiteur.nom || demande.visiteur.email}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {demande.prix.total > 0 ? formaterPrix(demande.prix.total, langue) : t("admin.surDevis")}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formaterDateHeure(demande.creeLe, langue)}</span>
                    <span className="flex items-center gap-1 font-semibold text-[#001D35]">
                      Consulter <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
          {page.page > 1 ? (
            <Link
              href={lien(page.page - 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{t("admin.precedente")}</span>
            </Link>
          ) : (
            <span />
          )}

          <span className="font-medium text-slate-500">
            {t("admin.pagination", { page: page.page, pages })}
          </span>

          {page.page < pages ? (
            <Link
              href={lien(page.page + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span>{t("admin.suivante")}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

function BadgeStatutModernise({ statut, libelle }: { statut: StatutDemande; libelle: string }) {
  let style = "bg-slate-100 text-slate-700 border-slate-200";
  let dot = "bg-slate-400";

  switch (statut) {
    case "envoyee":
      style = "bg-amber-50 text-amber-900 border-amber-200";
      dot = "bg-amber-500 animate-pulse";
      break;
    case "acceptee":
      style = "bg-blue-50 text-blue-900 border-blue-200";
      dot = "bg-blue-500";
      break;
    case "confirmee":
      style = "bg-emerald-50 text-emerald-900 border-emerald-200";
      dot = "bg-emerald-500";
      break;
    case "terminee":
      style = "bg-slate-100 text-slate-700 border-slate-200";
      dot = "bg-slate-400";
      break;
    case "refusee":
      style = "bg-rose-50 text-rose-900 border-rose-200";
      dot = "bg-rose-500";
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{libelle}</span>
    </span>
  );
}

function texte(valeur: string | string[] | undefined): string | undefined {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  return brut?.trim() || undefined;
}

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
