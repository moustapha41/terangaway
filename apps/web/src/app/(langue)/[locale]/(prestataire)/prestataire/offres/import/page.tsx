import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Import par tableur (PAR-01).
 *
 * Beaucoup de partenaires tiennent déjà leurs biens dans un fichier. Leur
 * demander de ressaisir dix logements un par un serait le meilleur moyen de ne
 * jamais les avoir. Les colonnes du modèle sont exactement les champs du PRD §11.
 */
export default async function Import({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <>

      <main className="max-w-[700px]">
        <Lien
          href="/prestataire/offres"
          className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
        >
          <Icone nom="retour" taille={16} />
          {t("prestataire.mesOffres")}
        </Lien>

        <h1 className="mt-4 text-titre-1 text-encre">{t("prestataire.importTitre")}</h1>
        <p className="mt-2 max-w-[70ch] text-corps text-encre-douce">{t("prestataire.importTexte")}</p>

        <Carte className="mt-6 space-y-3 p-5">
          {/* Les modèles sont de vrais fichiers : ils se téléchargent pour de bon. */}
          <a
            href="/modeles/logements.csv"
            download
            className="flex min-h-[var(--size-control)] items-center gap-3 rounded-control border border-contour px-4 text-corps text-encre hover:border-primaire/40"
          >
            <Icone nom="logement" taille={20} className="text-encre-douce" />
            {t("prestataire.importModeleLogements")}
          </a>
          <a
            href="/modeles/vehicules.csv"
            download
            className="flex min-h-[var(--size-control)] items-center gap-3 rounded-control border border-contour px-4 text-corps text-encre hover:border-primaire/40"
          >
            <Icone nom="voiture" taille={20} className="text-encre-douce" />
            {t("prestataire.importModeleVehicules")}
          </a>
          <p className="text-petit text-encre-douce">{t("prestataire.importColonnes")}</p>
        </Carte>

        <form className="mt-6 space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-petit text-encre">{t("prestataire.importFichier")}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="min-h-[var(--size-control)] rounded-control border border-contour-champ bg-surface px-3 py-2 text-corps text-encre file:mr-3 file:rounded-control file:border-0 file:bg-teinte-bleu file:px-3 file:py-1.5 file:text-petit file:font-semibold file:text-primaire"
            />
          </label>

          <Bandeau variante="information">{t("prestataire.importDemo")}</Bandeau>

          <Bouton type="submit" variante="principal" largeur="pleine">
            {t("prestataire.importEnvoyer")}
          </Bouton>
        </form>
      </main>
    </>
  );
}
