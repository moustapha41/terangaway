import { redirect } from "next/navigation";
import { FormulaireConnexionAdmin } from "@/features/admin/formulaire-connexion";
import { administrateurConnecte } from "@/features/admin/session";
import { estLangue } from "@/lib/i18n/langues";

/**
 * Rendu à la demande, toujours.
 *
 * Sans cette ligne, Next prérend la page au build : le cookie d'équipe est
 * alors absent, la redirection vers la connexion part dans le HTML statique,
 * et le backoffice reste fermé même pour qui a une session valide.
 */
export const dynamic = "force-dynamic";

/** Connexion de l'équipe. Déjà connecté, on n'a rien à y faire : on entre. */
export default async function ConnexionAdmin({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";
  if (await administrateurConnecte()) redirect(`/${langue}/admin`);

  return (
    <div className="py-8">
      <FormulaireConnexionAdmin />
    </div>
  );
}
