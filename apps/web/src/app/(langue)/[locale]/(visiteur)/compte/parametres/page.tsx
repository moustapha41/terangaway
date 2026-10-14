import { Icone } from "@teranga/ui";
import { Reglages } from "@/features/client/reglages";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/** Paramètres — langue, devise, notifications, et les textes légaux. */
export default async function Parametres({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-5 text-titre-1 text-encre">{t("client.parametresTitre")}</h1>

      <Reglages />

      <nav className="mt-6 overflow-hidden rounded-card border border-contour bg-surface">
        {[
          { cle: "confidentialite", href: "/legal#donnees" },
          { cle: "conditions", href: "/legal#role" },
          { cle: "aide", href: "/aide" },
        ].map((entree) => (
          <Lien
            key={entree.cle}
            href={entree.href}
            className="flex min-h-[var(--size-control)] items-center gap-3 border-b border-contour px-5 text-petit text-encre transition-colors last:border-0 hover:bg-champ"
          >
            <span className="flex-1">{t(`client.${entree.cle}`)}</span>
            <Icone nom="chevron-droite" taille={20} className="text-encre-douce" />
          </Lien>
        ))}
      </nav>
    </div>
  );
}
