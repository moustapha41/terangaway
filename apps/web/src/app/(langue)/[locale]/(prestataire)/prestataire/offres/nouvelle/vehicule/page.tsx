import { CATEGORIES_VEHICULE } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { enregistrerVehicule } from "@/features/prestataire/actions";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Dépôt d'un véhicule.
 *
 * Mêmes principes que le logement : une seule page, HTML natif, action serveur,
 * et un départ en brouillon — l'équipe publie, pas le partenaire.
 *
 * Les prix sont conditionnels : « prix par trajet » n'a de sens que si le
 * partenaire propose le trajet, « prix par jour » que s'il propose la location.
 * Les deux champs sont donc présents mais facultatifs, et le libellé le dit.
 */
export default async function NouveauVehicule({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  return (
    <>

      <main className="max-w-[720px]">
        <Lien
          href="/prestataire/offres"
          className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
        >
          <Icone nom="retour" taille={16} />
          {t("prestataire.mesOffres")}
        </Lien>

        <h1 className="mt-4 text-titre-1 text-encre">{t("prestataire.vehiculeTitre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">{t("prestataire.nouvelleTexte")}</p>

        <form action={enregistrerVehicule} className="mt-8 space-y-6">
          <Carte className="space-y-4 p-5">
            <fieldset>
              <legend className="mb-2 text-petit text-encre">
                {t("prestataire.vehiculeOffres")}
              </legend>
              {[
                { valeur: "trajet-avec-chauffeur", libelle: t("prestataire.vehiculeTrajet") },
                { valeur: "location-avec-chauffeur", libelle: t("prestataire.vehiculeLocation") },
              ].map((choix, i) => (
                <label
                  key={choix.valeur}
                  className="flex min-h-[var(--size-touch)] items-center gap-3 text-corps text-encre"
                >
                  <input
                    type="checkbox"
                    name="offres"
                    value={choix.valeur}
                    defaultChecked={i === 0}
                    className="h-5 w-5 accent-[var(--color-primaire)]"
                  />
                  {choix.libelle}
                </label>
              ))}
            </fieldset>

            <Select nom="categorie" libelle={t("prestataire.champCategorie")} requis>
              {CATEGORIES_VEHICULE.map((categorie) => (
                <option key={categorie} value={categorie}>
                  {t(`categorieVehicule.${categorie}`)}
                </option>
              ))}
            </Select>

            <div className="grid gap-4 sm:grid-cols-3">
              <Champ nom="marque" libelle={t("prestataire.champMarque")} requis />
              <Champ nom="modele" libelle={t("prestataire.champModele")} requis />
              <Champ nom="annee" libelle={t("prestataire.champAnnee")} type="number" min={2000} defaut="2022" requis />
            </div>
          </Carte>

          <Carte className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ nom="placesPassagers" libelle={t("prestataire.champPlaces")} type="number" min={1} defaut="4" requis />
              <Champ nom="bagages" libelle={t("prestataire.champBagages")} type="number" min={0} defaut="2" requis />
            </div>

            <label className="flex min-h-[var(--size-touch)] items-center gap-3 text-corps text-encre">
              <input
                type="checkbox"
                name="climatisation"
                value="oui"
                defaultChecked
                className="h-5 w-5 accent-[var(--color-primaire)]"
              />
              {t("prestataire.champClimatisation")}
            </label>

            <Champ
              nom="zones"
              libelle={t("prestataire.champZones")}
              aide={t("prestataire.champZonesAide")}
              defaut="Dakar, Diamniadio, Aéroport AIBD"
              requis
            />
          </Carte>

          <Carte className="grid gap-4 p-5 sm:grid-cols-2">
            <Champ nom="prixParTrajet" libelle={t("prestataire.champPrixTrajet")} type="number" min={0} pas={1000} />
            <Champ nom="prixParJour" libelle={t("prestataire.champPrixJour")} type="number" min={0} pas={1000} />
          </Carte>

          <Bandeau variante="information">{t("prestataire.rappelValidation")}</Bandeau>
          <Bandeau variante="avertissement">{t("prestataire.rappelAcompte")}</Bandeau>

          <Bouton type="submit" variante="principal" largeur="pleine">
            {t("prestataire.envoyerEnValidation")}
          </Bouton>
        </form>
      </main>
    </>
  );
}

const CHAMP =
  "min-h-[var(--size-control)] w-full rounded-control border border-contour-champ bg-surface px-3 " +
  "text-corps text-encre outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primaire";

function Champ({
  nom,
  libelle,
  aide,
  type = "text",
  min,
  pas,
  defaut,
  requis,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  type?: string;
  min?: number;
  pas?: number;
  defaut?: string;
  requis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={nom} className="text-petit text-encre">
        {libelle}
        {requis && (
          <span className="text-danger">
            {" *"}
            <span className="sr-only"> obligatoire</span>
          </span>
        )}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        min={min}
        step={pas}
        defaultValue={defaut}
        required={requis}
        aria-describedby={aide ? `${nom}-aide` : undefined}
        className={type === "number" ? `${CHAMP} chiffres-tabulaires` : CHAMP}
      />
      {aide && (
        <p id={`${nom}-aide`} className="text-petit text-encre-douce">
          {aide}
        </p>
      )}
    </div>
  );
}

function Select({
  nom,
  libelle,
  requis,
  children,
}: {
  nom: string;
  libelle: string;
  requis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={nom} className="text-petit text-encre">
        {libelle}
      </label>
      <select id={nom} name={nom} required={requis} className={CHAMP}>
        {children}
      </select>
    </div>
  );
}
