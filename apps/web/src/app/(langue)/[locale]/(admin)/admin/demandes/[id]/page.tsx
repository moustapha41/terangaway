import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  Luggage,
  Plane,
  Coins,
  History,
  MessageSquare,
  Building,
  Car,
  Compass,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { CoordonneesAdmin, DemandeAdmin, StatutDemande, VueAcompteAdmin } from "@teranga/contracts";
import { ErreurApi } from "@/lib/api/http";
import { formaterDateHeure, formaterJour } from "@/features/admin/format";
import { ServeurInjoignable } from "@/features/admin/serveur-injoignable";
import { jetonAdmin, urlConnexionAdmin } from "@/features/admin/session";
import { TraitementDemande } from "@/features/admin/traitement-demande";
import { AcompteDemande } from "@/features/admin/acompte-demande";
import { CoordonneesDemande } from "@/features/admin/coordonnees-demande";
import {
  apiAdminAcompte,
  apiAdminCoordonnees,
  apiAdminDemande,
  apiAdminPrestataires,
} from "@/lib/api/administration";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { avecLangue } from "@/lib/i18n/chemins";
import { formaterPrix } from "@/lib/prix";

export const dynamic = "force-dynamic";

export default async function FicheDemandeAdmin({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(urlConnexionAdmin(langue));

  let demande: DemandeAdmin;
  let prestataires: Awaited<ReturnType<typeof apiAdminPrestataires>> = [];
  try {
    [demande, prestataires] = await Promise.all([
      apiAdminDemande(jeton, id),
      apiAdminPrestataires(jeton),
    ]);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 404) notFound();
    if (erreur instanceof ErreurApi && (erreur.statut === 401 || erreur.statut === 403)) {
      redirect(urlConnexionAdmin(langue));
    }
    return <ServeurInjoignable langue={langue} />;
  }

  // Lues à part : leur échec — migration en attente, session, réseau — ne
  // doit pas faire tomber la fiche, seulement leur encart.
  let coordonnees: CoordonneesAdmin | undefined;
  let erreurCoordonnees: { code: string; message: string } | undefined;
  try {
    coordonnees = await apiAdminCoordonnees(jeton, id);
  } catch (erreur) {
    erreurCoordonnees =
      erreur instanceof ErreurApi
        ? { code: erreur.code, message: erreur.message }
        : { code: "INJOIGNABLE", message: "" };
  }

  // L'acompte aussi est lu à part : son échec ne fait pas tomber la fiche.
  let acompte: VueAcompteAdmin | undefined;
  let erreurAcompte: { code: string } | undefined;
  try {
    acompte = await apiAdminAcompte(jeton, id);
  } catch (erreur) {
    erreurAcompte = { code: erreur instanceof ErreurApi ? erreur.code : "INJOIGNABLE" };
  }

  const retourLien = avecLangue(langue, "/admin/demandes");

  return (
    <div className="space-y-6">
      {/* Barre de retour et En-tête */}
      <div>
        <Link
          href={retourLien}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#001D35] transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("admin.retour")}</span>
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono sm:text-3xl">
              {demande.reference}
            </h1>
            <BadgeStatutFiche statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
              {t(`admin.genre.${demande.genre}`)}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{t("admin.recueLe")} {formaterDateHeure(demande.creeLe, langue)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Disposition principale en 2 colonnes */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Colonne de Gauche : Détails du dossier */}
        <div className="space-y-6">
          {/* 1. Carte Prestation */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {demande.offre.titre}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Détails de la réservation et dates retenues
                  </p>
                </div>
              </div>

              {demande.prix.total > 0 && (
                <div className="text-right">
                  <span className="block text-xs text-slate-400">Tarif figé</span>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {formaterPrix(demande.prix.total, langue)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3.5">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t("admin.sejour")}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {periode(demande, langue) || "—"}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t("admin.personnes")}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <User className="h-4 w-4 text-slate-400" />
                  {demande.personnes} voyageur{demande.personnes > 1 ? "s" : ""}
                </span>
              </div>

              {demande.heureArrivee && (
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {t("admin.heureArrivee")}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {demande.heureArrivee}
                  </span>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3.5">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t("admin.prixTotal")}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Coins className="h-4 w-4 text-slate-400" />
                  {demande.prix.total > 0 ? formaterPrix(demande.prix.total, langue) : t("admin.surDevis")}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Trajet transport (si applicable) */}
          {demande.transport && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {t("admin.trajetBloc")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Itinéraire, bagages et correspondance de vol
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {demande.transport.depart && (
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {t("admin.depart")}
                    </span>
                    <span className="font-semibold text-slate-900">{demande.transport.depart}</span>
                  </div>
                )}
                {demande.transport.arrivee && (
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {t("admin.arrivee")}
                    </span>
                    <span className="font-semibold text-slate-900">{demande.transport.arrivee}</span>
                  </div>
                )}
                {demande.transport.bagages !== undefined && (
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Luggage className="h-3.5 w-3.5 text-slate-400" />
                      {t("admin.bagages")}
                    </span>
                    <span className="font-semibold text-slate-900">{demande.transport.bagages}</span>
                  </div>
                )}
                {demande.transport.vol && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Plane className="h-3.5 w-3.5 text-slate-400" />
                      {t("admin.vol")}
                    </span>
                    <span className="font-semibold font-mono text-slate-900">{demande.transport.vol}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Service spécifique à la demande */}
          {demande.service && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {t("admin.detailsService")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t(`services.${demande.service.cle}Titre`)}
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-slate-100">
                {Object.entries(demande.service.details).map(([cle, valeur]) => (
                  <div key={cle} className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-slate-500">{libelleChamp(t, cle)}</span>
                    <span className="font-semibold text-slate-900">{libelleValeur(t, valeur)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Message du visiteur */}
          {demande.message && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {t("admin.messageVisiteur")}
                </h2>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50/80 p-4 border border-slate-100">
                <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {demande.message}
                </p>
              </div>
            </div>
          )}

          {/* 5. Historique / Frise chronologique */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {t("admin.historique")}
                </h2>
                <p className="text-xs text-slate-500">
                  Traçabilité des changements de statut et actions
                </p>
              </div>
            </div>

            <ol className="relative mt-6 border-l border-slate-200 ml-3 space-y-6">
              {demande.frise.map((etape, rang) => (
                <li key={`${etape.statut}-${rang}`} className="ml-5">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#001D35] ring-2 ring-slate-200" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {t(`statut.${etape.statut}`)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formaterDateHeure(etape.horodatage, langue)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Origine : <span className="font-medium text-slate-700">{t(`admin.origine.${etape.origine}`)}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Colonne de Droite : Fiche Contact & Console de traitement */}
        <div className="space-y-6">
          {/* Visiteur & Coordonnées */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {t("admin.visiteur")}
                </h2>
                <p className="text-xs text-slate-500">Coordonnées de contact direct</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {demande.visiteur.nom || "Client visiteur"}
                </span>
                <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                  ID: {demande.visiteur.id}
                </span>
              </div>

              {demande.visiteur.email && (
                <a
                  href={`mailto:${demande.visiteur.email}`}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                >
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{demande.visiteur.email}</span>
                </a>
              )}

              {demande.visiteur.telephone && (
                <a
                  href={`tel:${demande.visiteur.telephone}`}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                >
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{demande.visiteur.telephone}</span>
                </a>
              )}
            </div>
          </div>

          {/* Prestataire actuel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {t("admin.prestataire")}
                </h2>
                <p className="text-xs text-slate-500">Partenaire en charge de l&apos;exécution</p>
              </div>
            </div>

            <div className="mt-4">
              {demande.prestataire ? (
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-slate-900 block">
                    {demande.prestataire.nom}
                  </span>
                  {demande.prestataire.email && (
                    <a
                      href={`mailto:${demande.prestataire.email}`}
                      className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
                    >
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{demande.prestataire.email}</span>
                    </a>
                  )}
                  {demande.prestataire.telephone && (
                    <a
                      href={`tel:${demande.prestataire.telephone}`}
                      className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{demande.prestataire.telephone}</span>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {t("admin.aucunPrestataire")}
                </p>
              )}
            </div>
          </div>

          {/* Coordonnées : saisie, puis vérification par une autre personne */}
          <CoordonneesDemande
            demandeId={demande.id}
            initiales={coordonnees}
            erreurChargement={erreurCoordonnees}
          />

          {/* Acompte : montants calculés par le serveur, constat manuel d'une réception */}
          <AcompteDemande demandeId={demande.id} initiale={acompte} erreurChargement={erreurAcompte} />

          {/* Console de Traitement */}
          <TraitementDemande demande={demande} prestataires={prestataires} />
        </div>
      </div>
    </div>
  );
}

function BadgeStatutFiche({ statut, libelle }: { statut: StatutDemande; libelle: string }) {
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{libelle}</span>
    </span>
  );
}

function periode(demande: DemandeAdmin, langue: Langue): string | undefined {
  const { debut, fin } = demande.dates;
  if (!debut && !fin) return undefined;
  if (!fin || fin === debut) return formaterJour(debut, langue);
  return `${formaterJour(debut, langue)} → ${formaterJour(fin, langue)}`;
}

function libelleChamp(t: Traducteur, cle: string): string {
  const traduit = t(`demandeService.champ.${cle}`);
  return traduit === `demandeService.champ.${cle}` ? cle : traduit;
}

function libelleValeur(t: Traducteur, valeur: string): string {
  const traduit = t(`demandeService.champ.${valeur}`);
  return traduit === `demandeService.champ.${valeur}` ? valeur : traduit;
}
