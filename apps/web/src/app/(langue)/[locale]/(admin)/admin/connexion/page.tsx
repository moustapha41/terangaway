import { redirect } from "next/navigation";
import { Bandeau } from "@teranga/ui";
import { FormulaireConnexionAdmin } from "@/features/admin/formulaire-connexion";
import { administrateurConnecte } from "@/features/admin/session";
import { apiMockActive } from "@/lib/api/http";
import { estLangue } from "@/lib/i18n/langues";
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
 * Connexion de l'équipe.
 *
 * Déjà connecté, on entre. Sinon, on explique clairement quand le site tourne
 * encore sur le mock : le backoffice parle à l'API réelle, et un code OTP
 * simulé n'y mène pas.
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
    <div className="py-8">
      {avertissement && (
        <div className="mx-auto mb-4 max-w-[460px]">
          <Bandeau variante={mock ? "avertissement" : "information"}>{avertissement}</Bandeau>
        </div>
      )}
      <FormulaireConnexionAdmin desactive={mock} />
    </div>
  );
}
