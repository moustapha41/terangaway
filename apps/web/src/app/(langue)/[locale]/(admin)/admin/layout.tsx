import { Logo } from "@/components/layout/logo";
import { BarreAdmin } from "@/features/admin/barre-admin";
import { administrateurConnecte } from "@/features/admin/session";
import { Lien } from "@/lib/i18n/lien";
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
 * Enveloppe du backoffice.
 *
 * Deux états : connecté — barre, navigation, contenu — ou non, et alors la
 * page de connexion s'affiche seule. Le layout ne décide de rien d'autre :
 * c'est chaque page qui exige la session, pour qu'une page ajoutée plus tard
 * ne se croie pas protégée par ce fichier.
 */
export default async function LayoutAdmin({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);
  const compte = await administrateurConnecte();

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-contour bg-surface">
        <div className="mx-auto flex w-[92%] max-w-[1260px] items-center gap-4 py-4">
          <Lien href={compte ? "/admin" : "/"} className="flex shrink-0 items-center gap-2.5">
            <Logo forme="marque" hauteur={34} />
            <span className="leading-tight">
              <span className="block text-titre-3 text-encre">{t("commun.nomApplication")}</span>
              <span className="block text-legende text-encre-douce">{t("admin.espace")}</span>
            </span>
          </Lien>

          {compte && (
            <div className="ml-auto flex items-center gap-4">
              <span className="hidden text-petit text-encre-douce sm:block">
                {compte.nom ?? compte.email}
              </span>
              <BarreAdmin />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-[92%] max-w-[1260px] pb-16 pt-6">{children}</main>
    </div>
  );
}
