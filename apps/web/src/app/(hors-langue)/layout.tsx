import "@fontsource-variable/inter";
import "@/styles/globals.css";

/**
 * Layout racine des pages hors langue : la page de réponse du partenaire, ouverte
 * depuis un SMS sans compte (PAR-11), et l'atelier des composants.
 *
 * La page partenaire sera traduite plus tard à partir de la langue enregistrée
 * sur le partenaire, pas de celle du visiteur.
 */
export default function LayoutHorsLangue({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
