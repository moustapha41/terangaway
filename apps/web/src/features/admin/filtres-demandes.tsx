import type { FiltresDemandesAdmin, StatutDemande } from "@teranga/contracts";
import { GENRES_DEMANDE, SERVICES_A_LA_DEMANDE, STATUTS_DEMANDE } from "@teranga/contracts";
import { Search, Filter, RotateCcw, Calendar, Tag, Layers, Check } from "lucide-react";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import Link from "next/link";
import { avecLangue } from "@/lib/i18n/chemins";

export function FiltresDemandes({
  filtres,
  langue,
}: {
  filtres: FiltresDemandesAdmin;
  langue: Langue;
  total?: number;
}) {
  const t = traducteurPour(langue);

  const ongletsStatut: { statut?: StatutDemande; label: string; couleur: string }[] = [
    { statut: undefined, label: "Toutes", couleur: "bg-slate-100 text-slate-800" },
    { statut: "envoyee", label: "À traiter (Envoyée)", couleur: "bg-amber-100 text-amber-900 border-amber-300" },
    { statut: "acceptee", label: "Acceptée", couleur: "bg-blue-100 text-blue-900 border-blue-300" },
    { statut: "confirmee", label: "Confirmée", couleur: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    { statut: "terminee", label: "Terminée", couleur: "bg-slate-100 text-slate-700 border-slate-300" },
    { statut: "refusee", label: "Refusée", couleur: "bg-rose-100 text-rose-900 border-rose-300" },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* 1. Raccourcis d'onglets rapides par Statut */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Filtrage rapide par statut
        </p>
        <div className="flex flex-wrap gap-2">
          {ongletsStatut.map((item) => {
            const estActif = filtres.statut === item.statut;
            const params = new URLSearchParams();
            if (item.statut) params.set("statut", item.statut);
            if (filtres.genre) params.set("genre", filtres.genre);
            if (filtres.service) params.set("service", filtres.service);
            if (filtres.recherche) params.set("recherche", filtres.recherche);
            const query = params.toString();
            const href = avecLangue(langue, `/admin/demandes${query ? `?${query}` : ""}`);

            return (
              <Link
                key={item.label}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  estActif
                    ? "bg-[#001D35] text-white shadow-sm ring-2 ring-[#001D35]/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {estActif && <Check className="h-3.5 w-3.5 text-amber-400" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* 2. Formulaire détaillé (Recherche, Catégories, Période) */}
      <form method="get" action={`/${langue}/admin/demandes`} className="space-y-4">
        {filtres.statut && <input type="hidden" name="statut" value={filtres.statut} />}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Recherche textuelle */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {t("admin.rechercher")}
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="recherche"
                defaultValue={filtres.recherche ?? ""}
                placeholder="Réf (ex: REF-DEM-...), nom, e-mail, tél..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
              />
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {t("admin.parGenre")}
            </label>
            <select
              name="genre"
              defaultValue={filtres.genre ?? ""}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            >
              <option value="">{t("admin.tousGenres")}</option>
              {GENRES_DEMANDE.map((g) => (
                <option key={g} value={g}>
                  {t(`admin.genre.${g}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Service spécifique */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {t("services.nosServices")}
            </label>
            <select
              name="service"
              defaultValue={filtres.service ?? ""}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            >
              <option value="">{t("admin.tousServices")}</option>
              {SERVICES_A_LA_DEMANDE.map((s) => (
                <option key={s} value={s}>
                  {t(`services.${s}Titre`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates et boutons d'action */}
        <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t("admin.du")}
              </label>
              <input
                type="date"
                name="du"
                defaultValue={filtres.du ?? ""}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t("admin.au")}
              </label>
              <input
                type="date"
                name="au"
                defaultValue={filtres.au ?? ""}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#001D35] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#002B4F] cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{t("admin.filtrer")}</span>
            </button>

            <Link
              href={avecLangue(langue, "/admin/demandes")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span>{t("admin.effacer")}</span>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
