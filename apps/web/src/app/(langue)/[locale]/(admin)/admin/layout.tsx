import { administrateurConnecte } from "@/features/admin/session";
import { NavbarAdmin } from "@/features/admin/navbar";
import { estLangue } from "@/lib/i18n/langues";

export const dynamic = "force-dynamic";

/**
 * Enveloppe du backoffice avec Navbar supérieure moderne.
 *
 * Élimination de la barre latérale au profit d'une barre de navigation horizontale (Navbar)
 * aérée avec menu Settings dédié (paramètres du système & utilisateurs).
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

  // Shell d'administration avec Navbar supérieure
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 antialiased flex flex-col">
      <NavbarAdmin compte={compte} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl w-full p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
