import { EnTeteSession } from "@/components/layout/en-tete-session";
import { PiedDePage } from "@/components/layout/pied-de-page";
import { estLangue } from "@/lib/i18n/langues";

/** Les pages publiques portent la même enveloppe que les écrans visiteur. */
export default async function LayoutPublic({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";

  return (
    <>
      <EnTeteSession />
      {children}
      <PiedDePage langue={langue} />
    </>
  );
}
