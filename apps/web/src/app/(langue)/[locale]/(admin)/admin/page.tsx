import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  CalendarCheck,
  BarChart3,
  ArrowRight,
  TrendingUp,
  Building,
  Car,
  Key,
  Compass,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  ShieldCheck,
} from "lucide-react";
import {
  STATUTS_DEMANDE,
  GENRES_DEMANDE,
  type DemandeAdmin,
  type StatutDemande,
  type GenreDemande,
} from "@teranga/contracts";
import { BadgeStatut } from "@/components/admin/badge-statut";
import { ServeurInjoignable } from "@/features/admin/serveur-injoignable";
import { jetonAdmin, urlConnexionAdmin } from "@/features/admin/session";
import { apiAdminDemandes, apiAdminTableauDeBord } from "@/lib/api/administration";
import { ErreurApi } from "@/lib/api/http";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { avecLangue } from "@/lib/i18n/chemins";

export const dynamic = "force-dynamic";

export default async function TableauDeBord({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(urlConnexionAdmin(langue));

  let bord;
  try {
    bord = await apiAdminTableauDeBord(jeton);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.statut === 401 || erreur.statut === 403)) {
      redirect(urlConnexionAdmin(langue));
    }
    return <ServeurInjoignable langue={langue} />;
  }

  /**
   * Les dernières demandes, tous statuts confondus.
   *
   * Les quatre compteurs ne disent que ce qui reste à faire : un matin où tout
   * a été traité — ou expiré —, ils affichent quatre zéros, et le tableau de
   * bord paraît vide alors que la base ne l'est pas. Cette liste montre ce qui
   * est arrivé, et pas seulement ce qui attend.
   *
   * Si elle échoue, le reste de l'écran tient : elle complète les compteurs,
   * elle ne les remplace pas.
   */
  let dernieres: DemandeAdmin[] = [];
  try {
    dernieres = (await apiAdminDemandes(jeton, { parPage: 6 })).demandes;
  } catch (erreur) {
    console.error("[admin] dernières demandes indisponibles", erreur);
  }

  const kpis = [
    {
      cle: "aTraiter",
      titre: t("admin.aTraiter"),
      valeur: bord.aTraiter,
      icone: AlertTriangle,
      badge: bord.aTraiter > 0 ? "Action requise" : "À jour",
      couleurCard: "border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-white",
      couleurIcone: "bg-amber-100 text-amber-700 ring-amber-200/60",
      couleurBadge: bord.aTraiter > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200",
      lien: avecLangue(langue, "/admin/demandes?statut=envoyee"),
      description: "Demandes en attente d'une première décision",
    },
    {
      cle: "enRetard",
      titre: t("admin.enRetard"),
      valeur: bord.enRetard,
      icone: Clock,
      badge: bord.enRetard > 0 ? "Urgent" : "Aucun retard",
      couleurCard: "border-rose-200/80 bg-gradient-to-br from-rose-50/50 via-white to-white",
      couleurIcone: "bg-rose-100 text-rose-700 ring-rose-200/60",
      couleurBadge: bord.enRetard > 0 ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200",
      lien: avecLangue(langue, "/admin/demandes?statut=envoyee"),
      description: "Délai maximum de prise en charge dépassé",
    },
    {
      cle: "aujourdhui",
      titre: t("admin.aujourdhui"),
      valeur: bord.aujourdhui,
      icone: CalendarCheck,
      badge: "Aujourd'hui",
      couleurCard: "border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-white to-white",
      couleurIcone: "bg-blue-100 text-blue-700 ring-blue-200/60",
      couleurBadge: "bg-blue-100 text-blue-800 border-blue-200",
      lien: avecLangue(langue, "/admin/demandes"),
      description: "Arrivées enregistrées depuis minuit (Dakar)",
    },
    {
      cle: "total",
      titre: t("admin.total"),
      valeur: bord.total,
      icone: BarChart3,
      badge: "Historique",
      couleurCard: "border-slate-200 bg-white",
      couleurIcone: "bg-slate-100 text-slate-700 ring-slate-200/60",
      couleurBadge: "bg-slate-100 text-slate-700 border-slate-200",
      lien: avecLangue(langue, "/admin/demandes"),
      description: "Volume cumulé toutes catégories confondues",
    },
  ];

  return (
    <div className="space-y-8">
      {/* En-tête de bienvenue & Actions rapides */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("admin.navTableauDeBord")}
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              En direct
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Supervision opérationnelle des réservations et des flux partenaires.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={avecLangue(langue, "/admin/demandes/export")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>{t("admin.exporter")}</span>
          </Link>
          <Link
            href={avecLangue(langue, "/admin/demandes")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#001D35] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#002B4F]"
          >
            <span>{t("admin.navDemandes")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Cartes KPI métriques */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icone = kpi.icone;
          return (
            <Link
              key={kpi.cle}
              href={kpi.lien}
              className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${kpi.couleurCard}`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${kpi.couleurIcone}`}>
                  <Icone className="h-5 w-5" />
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${kpi.couleurBadge}`}>
                  {kpi.badge}
                </span>
              </div>

              <div className="mt-4">
                <span className="block text-3xl font-extrabold tracking-tight text-slate-900 chiffres-tabulaires">
                  {kpi.valeur}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-slate-800">
                  {kpi.titre}
                </span>
                <span className="mt-1 block text-xs text-slate-500 leading-snug">
                  {kpi.description}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-600 group-hover:text-slate-900">
                <span>Voir les détails</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Les dernières demandes reçues */}
      {dernieres.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t("admin.dernieresDemandes")}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{t("admin.dernieresDemandesTexte")}</p>
            </div>
            <Link
              href={avecLangue(langue, "/admin/demandes")}
              className="text-xs font-semibold text-[#001D35] hover:underline"
            >
              {t("admin.voirTout")}
            </Link>
          </div>

          <ul className="divide-y divide-slate-100">
            {dernieres.map((demande) => (
              <li key={demande.id}>
                <Link
                  href={avecLangue(langue, `/admin/demandes/${demande.id}`)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5 transition hover:bg-slate-50"
                >
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {demande.reference}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                    {demande.offre.titre}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {demande.visiteur.nom || demande.visiteur.email || "—"}
                  </span>
                  <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section Graphiques & Répartitions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Répartition par Statut */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t("admin.parStatut")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ventilation par état dans le cycle de vie
              </p>
            </div>
            <Link
              href={avecLangue(langue, "/admin/demandes")}
              className="text-xs font-semibold text-[#001D35] hover:underline"
            >
              Voir tout
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {STATUTS_DEMANDE.map((statut) => {
              const count = bord.parStatut[statut] ?? 0;
              const maxVal = Math.max(...Object.values(bord.parStatut), 1);
              const pourcentage = Math.round((count / maxVal) * 100);
              const info = obtenirStyleStatut(statut);

              return (
                <Link
                  key={statut}
                  href={avecLangue(langue, `/admin/demandes?statut=${statut}`)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${info.point}`} />
                      <span className="text-slate-800 group-hover:text-slate-950 font-medium">
                        {t(`statut.${statut}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-slate-900 chiffres-tabulaires">{count}</span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${info.barre}`}
                      style={{ width: `${pourcentage}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Répartition par Genre d'offre */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t("admin.parGenre")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Répartition par type d&apos;activité et de service
              </p>
            </div>
            <Link
              href={avecLangue(langue, "/admin/demandes")}
              className="text-xs font-semibold text-[#001D35] hover:underline"
            >
              Voir tout
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {GENRES_DEMANDE.map((genre) => {
              const count = bord.parGenre[genre] ?? 0;
              const totalGenre = Math.max(Object.values(bord.parGenre).reduce((a, b) => a + b, 0), 1);
              const pourcentage = Math.round((count / totalGenre) * 100);
              const iconeGenre = obtenirIconeGenre(genre);
              const Icone = iconeGenre.icone;

              return (
                <Link
                  key={genre}
                  href={avecLangue(langue, `/admin/demandes?genre=${genre}`)}
                  className="group block rounded-xl p-2.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#001D35] group-hover:text-amber-300 transition-colors">
                        <Icone className="h-4 w-4" />
                      </div>
                      <span className="text-slate-800 group-hover:text-slate-950 font-semibold">
                        {t(`admin.genre.${genre}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400 text-[11px]">{pourcentage}%</span>
                      <span className="font-bold text-slate-900 chiffres-tabulaires">{count}</span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#001D35] transition-all duration-500"
                      style={{ width: `${pourcentage}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bannière de rappel opérationnel */}
      <div className="rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Protocole de traitement des demandes
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
                Les demandes avec le statut <strong>En attente</strong> doivent recevoir une confirmation ou un chiffrage sous 24 heures afin de garantir une expérience visiteur optimale.
              </p>
            </div>
          </div>
          <Link
            href={avecLangue(langue, "/admin/demandes?statut=envoyee")}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <span>Traiter les {bord.aTraiter} en attente</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function obtenirStyleStatut(statut: StatutDemande) {
  switch (statut) {
    case "envoyee":
      return { point: "bg-amber-500", barre: "bg-amber-500" };
    case "acceptee":
      return { point: "bg-blue-500", barre: "bg-blue-500" };
    case "confirmee":
      return { point: "bg-emerald-500", barre: "bg-emerald-500" };
    case "terminee":
      return { point: "bg-slate-400", barre: "bg-slate-400" };
    case "refusee":
      return { point: "bg-rose-500", barre: "bg-rose-500" };
    case "expiree":
    case "annulee":
    default:
      return { point: "bg-slate-300", barre: "bg-slate-300" };
  }
}

function obtenirIconeGenre(genre: GenreDemande) {
  switch (genre) {
    case "logement":
      return { icone: Building };
    case "trajet":
      return { icone: Car };
    case "location":
      return { icone: Key };
    case "taxi":
      return { icone: Car };
    case "service":
    default:
      return { icone: Compass };
  }
}
