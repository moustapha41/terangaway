import { TYPES_LOGEMENT } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { enregistrerOffre } from "@/features/prestataire/actions";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";

/**
 * Dépôt d'un logement — le cœur de l'espace prestataire.
 *
 * Formulaire sur **une seule page** : « priorité à la vitesse de saisie »
 * (§C.8). Un partenaire qui dépose dix logements ne doit pas traverser six
 * écrans à chaque fois.
 *
 * Tout est en HTML natif et posté par une action serveur. Le partenaire saisit
 * souvent depuis un téléphone modeste, parfois en 2G : la page doit marcher même
 * si le JavaScript n'arrive jamais.
 */
export default async function NouveauLogement({
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

        <h1 className="mt-4 text-titre-1 text-encre">{t("prestataire.nouvelleTitre")}</h1>
        <p className="mt-2 text-corps text-encre-douce">{t("prestataire.nouvelleTexte")}</p>

        <form action={enregistrerOffre} className="mt-8 space-y-6">
          <Groupe titre={t("prestataire.sectionIdentite")}>
            <Select nom="type" libelle={t("prestataire.champType")} requis>
              {TYPES_LOGEMENT.map((type) => (
                <option key={type} value={type}>
                  {t(`typeLogement.${type}`)}
                </option>
              ))}
            </Select>
            <Texte
              nom="titre"
              libelle={t("prestataire.champTitre")}
              aide={t("prestataire.champTitreAide")}
              requis
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Texte nom="ville" libelle={t("prestataire.champVille")} defaut="Dakar" requis />
              <Texte nom="quartier" libelle={t("prestataire.champQuartier")} requis />
            </div>
          </Groupe>

          <Groupe titre={t("prestataire.sectionCapacite")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Nombre nom="capacite" libelle={t("prestataire.champCapacite")} min={1} defaut={2} requis />
              <Nombre nom="chambres" libelle={t("prestataire.champChambres")} min={1} defaut={1} requis />
            </div>
          </Groupe>

          <Groupe titre={t("prestataire.sectionPrix")}>
            <Nombre
              nom="prixParNuit"
              libelle={t("prestataire.champPrix")}
              aide={t("prestataire.champPrixAide")}
              min={1000}
              pas={1000}
              defaut={50000}
              requis
            />
          </Groupe>

          <Groupe titre={t("prestataire.sectionConditions")}>
            <ZoneTexte
              nom="description"
              libelle={t("prestataire.champDescription")}
              aide={t("prestataire.champDescriptionAide")}
              requis
            />
            <ZoneTexte
              nom="conditionsAnnulation"
              libelle={t("prestataire.champAnnulation")}
              lignes={2}
              requis
            />
          </Groupe>

          <Rappels t={t} />

          <Bouton type="submit" variante="principal" largeur="pleine">
            {t("prestataire.envoyerEnValidation")}
          </Bouton>
        </form>
      </main>
    </>
  );
}

function Rappels({ t }: { t: Traducteur }) {
  return (
    <div className="space-y-3">
      <Bandeau variante="information">{t("prestataire.rappelValidation")}</Bandeau>
      <Bandeau variante="avertissement">{t("prestataire.rappelAcompte")}</Bandeau>
    </div>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Carte className="space-y-4 p-5">
      <h2 className="text-titre-3 text-encre">{titre}</h2>
      {children}
    </Carte>
  );
}

const CHAMP =
  "min-h-[var(--size-control)] w-full rounded-control border border-contour-champ bg-surface px-3 " +
  "text-corps text-encre outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primaire";

function Etiquette({
  nom,
  libelle,
  aide,
  requis,
  children,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  requis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={nom} className="text-petit text-encre">
        {libelle}
        {/* L'astérisque est doublée d'un mot pour les lecteurs d'écran. */}
        {requis && (
          <span className="text-danger">
            {" *"}
            <span className="sr-only"> obligatoire</span>
          </span>
        )}
      </label>
      {children}
      {aide && (
        <p id={`${nom}-aide`} className="text-petit text-encre-douce">
          {aide}
        </p>
      )}
    </div>
  );
}

function Texte({
  nom,
  libelle,
  aide,
  defaut,
  requis,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  defaut?: string;
  requis?: boolean;
}) {
  return (
    <Etiquette nom={nom} libelle={libelle} aide={aide} requis={requis}>
      <input
        id={nom}
        name={nom}
        defaultValue={defaut}
        required={requis}
        aria-describedby={aide ? `${nom}-aide` : undefined}
        className={CHAMP}
      />
    </Etiquette>
  );
}

function Nombre({
  nom,
  libelle,
  aide,
  min,
  pas,
  defaut,
  requis,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  min?: number;
  pas?: number;
  defaut?: number;
  requis?: boolean;
}) {
  return (
    <Etiquette nom={nom} libelle={libelle} aide={aide} requis={requis}>
      <input
        id={nom}
        name={nom}
        type="number"
        inputMode="numeric"
        min={min}
        step={pas}
        defaultValue={defaut}
        required={requis}
        aria-describedby={aide ? `${nom}-aide` : undefined}
        className={`${CHAMP} chiffres-tabulaires`}
      />
    </Etiquette>
  );
}

function ZoneTexte({
  nom,
  libelle,
  aide,
  lignes = 4,
  requis,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  lignes?: number;
  requis?: boolean;
}) {
  return (
    <Etiquette nom={nom} libelle={libelle} aide={aide} requis={requis}>
      <textarea
        id={nom}
        name={nom}
        rows={lignes}
        required={requis}
        aria-describedby={aide ? `${nom}-aide` : undefined}
        className={`${CHAMP} py-2`}
      />
    </Etiquette>
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
    <Etiquette nom={nom} libelle={libelle} requis={requis}>
      <select id={nom} name={nom} required={requis} className={CHAMP}>
        {children}
      </select>
    </Etiquette>
  );
}
