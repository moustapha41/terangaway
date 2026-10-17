import { redirect } from "next/navigation";
import { Bandeau } from "@teranga/ui";
import { FormulaireConnexionAdmin } from "@/features/admin/formulaire-connexion";
import { administrateurConnecte } from "@/features/admin/session";
import { apiMockActive } from "@/lib/api/http";
import { estLangue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { Logo } from "@/components/layout/logo";

export const dynamic = "force-dynamic";

/**
 * Connexion équipe — Interface d'authentification repensée
 */
export default async function ConnexionAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ motif?: string | string[] }>;
}) {
  const { locale } = await params;
  const requete = await searchParams;
  const langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  if (await administrateurConnecte()) redirect(`/${langue}/admin`);

  const motifBrut = Array.isArray(requete.motif) ? requete.motif[0] : requete.motif;
  const mock = apiMockActive();
  const avertissement = mock
    ? t("admin.avertissementMock")
    : motifBrut === "session"
      ? t("admin.avertissementSession")
      : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* En-tête de marque */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md shadow-2xl">
          <Logo forme="marque" variante="clair" hauteur={36} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          Teranga Way
        </h2>
        <p className="mt-1 text-xs font-medium text-amber-300 uppercase tracking-widest">
          Console d&apos;Administration
        </p>
      </div>

      {avertissement && (
        <div className="mb-6 w-full max-w-md">
          <Bandeau variante={mock ? "avertissement" : "information"}>{avertissement}</Bandeau>
        </div>
      )}

      <div className="w-full max-w-md">
        <FormulaireConnexionAdmin desactive={mock} />
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Accès strictement réservé aux gestionnaires et administrateurs autorisés.
      </p>
    </div>
  );
}
