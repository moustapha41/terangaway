import { Logo } from "@/components/layout/logo";
import { ColonnePrestataire } from "@/components/prestataire/colonne-prestataire";
import { prestataireConnecte } from "@/features/prestataire/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Enveloppe de l'espace prestataire — maquette du collage, écrans 5 à 7.
 *
 * Barre fine en haut, colonne de navigation à gauche. Les pages publiques de
 * l'espace — candidature et connexion — passent par ce layout sans session :
 * elles affichent alors la barre seule, sans colonne, puisqu'il n'y a pas
 * encore de compte à naviguer.
 */
export default async function LayoutPrestataire({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);
  const compte = await prestataireConnecte();

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-contour bg-surface">
        <div className="mx-auto flex w-[92%] max-w-[1180px] items-center gap-4 py-4">
          <Lien href={compte ? "/prestataire" : "/"} className="flex shrink-0 items-center gap-2.5">
            <Logo forme="marque" hauteur={34} />
            <span className="leading-tight">
              <span className="block text-titre-3 text-encre">{t("commun.nomApplication")}</span>
              <span className="block text-legende text-encre-douce">{t("prestataire.espace")}</span>
            </span>
          </Lien>

          {compte && (
            <p className="ml-auto flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-pill bg-teinte-bleu text-petit font-semibold text-primaire"
              >
                {compte.nom
                  .split(" ")
                  .map((m) => m[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-petit font-semibold text-encre">{compte.nom}</span>
                <span className="block text-legende text-succes">
                  {t("prestataire.prestataireVerifie")}
                </span>
              </span>
            </p>
          )}
        </div>
      </header>

      {compte ? (
        <div className="mx-auto grid w-[92%] max-w-[1180px] gap-8 pt-6 lg:grid-cols-[230px_1fr] lg:items-start">
          <ColonnePrestataire nom={compte.nom} />
          <div className="min-w-0 pb-16">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
