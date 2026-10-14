import { Bandeau, Bouton, Icone } from "@teranga/ui";
import { envoyerOffre } from "@/features/prestataire/actions";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import type { OffreDuPartenaire } from "@/mocks/fixtures/prestataire";

/**
 * En-tête commun aux trois pages d'édition d'une offre.
 *
 * Il porte ce qui bloque encore la publication et le bouton d'envoi : le
 * partenaire voit en permanence ce qui lui reste à faire, depuis n'importe quel
 * onglet. Reléguer cette information sur une seule page l'obligerait à naviguer
 * pour savoir où il en est.
 */
const ONGLETS = ["photos", "disponibilites", "tarifs"] as const;

const CLE_MANQUE: Record<string, string> = {
  photos: "prestataire.manquePhotos",
  disponibilite: "prestataire.manqueDisponibilite",
  prix: "prestataire.manqueprix",
  description: "prestataire.manquedescription",
};

export function OngletsOffre({
  offre,
  langue,
  actif,
}: {
  offre: OffreDuPartenaire;
  langue: Langue;
  actif: (typeof ONGLETS)[number];
}) {
  const t = traducteurPour(langue);
  const complet = offre.manquant.length === 0;

  return (
    <header className="space-y-5">
      <Lien
        href="/prestataire/offres"
        className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
      >
        <Icone nom="retour" taille={16} />
        {t("prestataire.mesOffres")}
      </Lien>

      <div>
        <h1 className="text-titre-1 text-encre">{offre.logement.titre}</h1>
        <p className="mt-1 text-petit text-encre-douce">
          {t(`prestataire.statutOffre.${offre.statut}`)}
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t("prestataire.editer")}>
        {ONGLETS.map((onglet) => (
          <Lien
            key={onglet}
            href={`/prestataire/offres/${offre.id}/${onglet}`}
            aria-current={onglet === actif ? "page" : undefined}
            className={
              "inline-flex min-h-[var(--size-touch)] items-center rounded-pill border px-4 text-petit font-semibold " +
              (onglet === actif
                ? "border-primaire bg-primaire text-white"
                : "border-contour bg-surface text-encre hover:border-primaire/40")
            }
          >
            {t(`prestataire.onglet${onglet[0].toUpperCase()}${onglet.slice(1)}`)}
          </Lien>
        ))}
      </nav>

      {offre.statut === "brouillon" &&
        (complet ? (
          <form action={envoyerOffre}>
            <input type="hidden" name="id" value={offre.id} />
            <Bouton type="submit" variante="principal" largeur="contenu" icone="verification">
              {t("prestataire.envoyerEnValidation")}
            </Bouton>
          </form>
        ) : (
          <Bandeau variante="avertissement">
            <strong className="block font-semibold">{t("prestataire.blocageTitre")}</strong>
            <span className="mt-1 block">
              {offre.manquant.map((manque) => t(CLE_MANQUE[manque] ?? manque)).join(" · ")}
            </span>
          </Bandeau>
        ))}
    </header>
  );
}
