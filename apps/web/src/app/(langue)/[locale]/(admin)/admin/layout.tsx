import { administrateurConnecte } from "@/features/admin/session";
import { SidebarAdmin } from "@/features/admin/sidebar";
import { TopbarAdmin } from "@/features/admin/topbar";
import { estLangue } from "@/lib/i18n/langues";

/**
 * Rendu à la demande, toujours.
 *
 * Sans cette ligne, Next prérend la page au build : le cookie d'équipe est
 * alors absent, la redirection vers la connexion part dans le HTML statique,
 * et le backoffice reste fermé même pour qui a une session valide.
 */
export const dynamic = "force-dynamic";

/**
 * Enveloppe du backoffice réinventée pour une ergonomie et un design de pointe.
 *
 * Deux états :
 * - Connecté : Layout avec Sidebar latérale permanente, Topbar avec fil d'Ariane,
 *   statut API temps-réel et zone de travail aérée et réactive.
 * - Non connecté (Connexion) : Vue centrée et épurée sans barre latérale pour la sécurité.
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
  const compte = await administrateurConnecte();

  // Si l'utilisateur n'est pas connecté (page de connexion)
  if (!compte) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#001427] via-[#001D35] to-[#0A2540] text-slate-800 antialiased flex flex-col justify-center">
        {children}
      </div>
    );
  }

  // Shell d'administration connecté
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 antialiased">
      <SidebarAdmin compte={compte} />

      <div className="lg:pl-72 flex flex-col min-h-screen">
        <TopbarAdmin />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
