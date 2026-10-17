import { redirect } from "next/navigation";
import { jetonAdmin, urlConnexionAdmin, administrateurConnecte } from "@/features/admin/session";
import { GestionUtilisateurs } from "@/features/admin/gestion-utilisateurs";
import { apiAdminPrestataires } from "@/lib/api/administration";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

export default async function UtilisateursAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(urlConnexionAdmin(langue));

  const compte = await administrateurConnecte();
  let prestataires: Awaited<ReturnType<typeof apiAdminPrestataires>> = [];
  try {
    prestataires = await apiAdminPrestataires(jeton);
  } catch {
    prestataires = [];
  }

  return (
    <div className="space-y-6">
      {/* En-tête de la page */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t("admin.navUtilisateurs")} & Équipe
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Supervisez les comptes d&apos;administration, les prestataires autorisés et leurs droits d&apos;accès.
        </p>
      </div>

      <GestionUtilisateurs administrateur={compte} prestataires={prestataires} />
    </div>
  );
}
