import { PiedDePage } from "@/components/layout/pied-de-page";
import { WhatsappFlottant } from "@/components/layout/whatsapp-flottant";
import { estLangue } from "@/lib/i18n/langues";

export default async function LayoutVisiteur({
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
      {children}
      <PiedDePage langue={langue} />
      <WhatsappFlottant />
    </>
  );
}
