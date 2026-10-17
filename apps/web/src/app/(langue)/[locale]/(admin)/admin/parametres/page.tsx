import { redirect } from "next/navigation";
import { jetonAdmin, urlConnexionAdmin } from "@/features/admin/session";
import { FormulaireParametres } from "@/features/admin/formulaire-parametres";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

export default async function ParametresAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(urlConnexionAdmin(langue));

  return (
    <div className="space-y-6">
      {/* En-tête de la page */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t("admin.navParametres")} du Système
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ajustez les paramètres opérationnels, les SLA de réponse, les devises et les alertes de la plateforme.
        </p>
      </div>

      <FormulaireParametres />
    </div>
  );
}
