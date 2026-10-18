import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
// Inter en WOFF2 servi par nos soins, comme le demande le dossier de conception §A.5.
import "@fontsource-variable/inter";
import "@/styles/globals.css";
import { FournisseurLangue } from "@/lib/i18n/contexte";
import { MesureAudience } from "@/components/layout/mesure-audience";
import { BandeauHorsLigne } from "@/lib/hors-ligne/bandeau";
import { EnregistrementServiceWorker } from "@/lib/hors-ligne/enregistrement";
import { LANGUES, estLangue } from "@/lib/i18n/langues";
import { catalogue, traducteurPour } from "@/lib/i18n/messages";

/**
 * Layout racine de l'application traduite.
 *
 * Il y a deux layouts racines dans ce projet : celui-ci, et celui de
 * `(hors-langue)` pour la page partenaire et l'atelier. C'est le seul moyen de
 * poser `<html lang>` à la langue réelle de la page — sans quoi un lecteur
 * d'écran lirait l'espagnol avec une voix française (§C.6).
 */
export function generateStaticParams() {
  return LANGUES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = traducteurPour(estLangue(locale) ? locale : "fr");
  return {
    title: `${t("commun.nomApplication")} — ${t("commun.baseline")}`,
    description: t("hero.sousTitre"),
    applicationName: t("commun.nomApplication"),
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icons/icone.svg", type: "image/svg+xml" },
        { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: { capable: true, title: t("commun.nomApplication"), statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#001d35",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Le §C.6 demande que le texte reste lisible à 200 % : on n'empêche pas le zoom.
  maximumScale: 5,
};

export default async function LayoutLangue({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!estLangue(locale)) notFound();
  const t = traducteurPour(locale);

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <FournisseurLangue langue={locale} messages={catalogue(locale)}>
          {/* Premier élément focalisable de la page : §C.6 demande que l'ordre de
              lecture suive l'ordre visuel et que l'élément actif reste visible. */}
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primaire focus:px-4 focus:py-2 focus:text-petit focus:font-semibold focus:text-white"
          >
            {t("horsLigne.allerAuContenu")}
          </a>
          <BandeauHorsLigne />
          <div id="contenu">{children}</div>
          <EnregistrementServiceWorker />
          <MesureAudience />
        </FournisseurLangue>
      </body>
    </html>
  );
}
