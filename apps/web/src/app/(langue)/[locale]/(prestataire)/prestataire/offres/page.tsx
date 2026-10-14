import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { dureeRestante } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { offresDuPartenaire, vehiculesDuPartenaire } from "@/mocks/api";
import type { StatutOffre } from "@/mocks/fixtures/prestataire";

/** Logements et véhicules, séparés : ce ne sont ni les mêmes champs ni le même cycle. */
const TEINTES: Record<StatutOffre, string> = {
  brouillon: "bg-teinte-gris text-encre-douce",
  "en-validation": "bg-teinte-orange text-alerte",
  publiee: "bg-teinte-vert text-succes",
  suspendue: "bg-teinte-rouge text-danger",
};

const CLE_MANQUE: Record<string, string> = {
  photos: "prestataire.manquePhotos",
  disponibilite: "prestataire.manqueDisponibilite",
  prix: "prestataire.manqueprix",
  description: "prestataire.manquedescription",
};

export default async function Offres({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ depose?: string; envoye?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { depose, envoye } = await searchParams;
  const t = traducteurPour(langue);

  const [logements, vehicules] = await Promise.all([
    offresDuPartenaire(),
    vehiculesDuPartenaire(),
  ]);

  return (
    <>

      <main>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-titre-1 text-encre">{t("prestataire.mesOffres")}</h1>

          <div className="flex flex-wrap gap-3">
            <Lien href="/prestataire/offres/nouvelle/logement">
              <Bouton variante="principal" largeur="contenu" icone="logement">
                {t("prestataire.nouvelleOffre")}
              </Bouton>
            </Lien>
            <Lien href="/prestataire/offres/nouvelle/vehicule">
              <Bouton variante="secondaire" largeur="contenu" icone="voiture">
                {t("prestataire.vehiculeTitre")}
              </Bouton>
            </Lien>
            <Lien href="/prestataire/offres/import">
              <Bouton variante="secondaire" largeur="contenu" icone="tri">
                {t("prestataire.importer")}
              </Bouton>
            </Lien>
          </div>
        </div>

        {depose && (
          <div className="mt-5">
            <Bandeau variante="succes">{t("prestataire.offreDeposee")}</Bandeau>
          </div>
        )}
        {envoye && (
          <div className="mt-5">
            <Bandeau variante="succes">{t("prestataire.envoye")}</Bandeau>
          </div>
        )}

        {logements.length === 0 && vehicules.length === 0 ? (
          <div className="mt-8 rounded-card border border-contour bg-surface px-6 py-12 text-center">
            <Icone nom="logement" taille={32} className="mx-auto text-encre-douce" />
            <h2 className="mt-4 text-titre-2 text-encre">{t("prestataire.aucuneOffre")}</h2>
            <p className="mx-auto mt-2 max-w-[48ch] text-corps text-encre-douce">
              {t("prestataire.aucuneOffreTexte")}
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            <section>
              <h2 className="mb-3 text-titre-3 text-encre">{t("entete.logements")}</h2>
              <ul className="space-y-4">
                {logements.map((offre) => (
                  <li key={offre.id}>
                    <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                      <Lien href={`/prestataire/offres/${offre.id}/photos`} className="block p-5">
                        <Entete
                          statut={offre.statut}
                          titre={offre.logement.titre}
                          detail={`${offre.logement.quartier}, ${offre.logement.ville} · ${formaterPrix(offre.logement.prixParNuit, langue)} ${t("commun.parNuit")}`}
                          quand={dureeRestante(new Date(offre.misAJourLe), langue)}
                          t={t}
                        />
                        <Manquant manquant={offre.manquant} t={t} />
                      </Lien>
                    </Carte>
                  </li>
                ))}
              </ul>
            </section>

            {vehicules.length > 0 && (
              <section>
                <h2 className="mb-3 text-titre-3 text-encre">{t("entete.transports")}</h2>
                <ul className="space-y-4">
                  {vehicules.map((offre) => (
                    <li key={offre.id}>
                      <Carte className="p-5">
                        <Entete
                          statut={offre.statut}
                          titre={`${offre.vehicule.marque} ${offre.vehicule.modele}`}
                          detail={`${t(`categorieVehicule.${offre.vehicule.categorie}`)} · ${t("transport.places", { nombre: offre.vehicule.placesPassagers })}`}
                          quand={dureeRestante(new Date(offre.misAJourLe), langue)}
                          t={t}
                        />
                        <Manquant manquant={offre.manquant} t={t} />
                      </Carte>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function Entete({
  statut,
  titre,
  detail,
  quand,
  t,
}: {
  statut: StatutOffre;
  titre: string;
  detail: string;
  quand: string;
  t: Traducteur;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <span className={`inline-block rounded-pill px-2.5 py-1 text-petit font-semibold ${TEINTES[statut]}`}>
          {t(`prestataire.statutOffre.${statut}`)}
        </span>
        <p className="mt-2 text-titre-3 text-encre">{titre}</p>
        <p className="mt-1 text-petit text-encre-douce">{detail}</p>
      </div>
      <p className="text-petit text-encre-douce">{t("prestataire.misAJour", { quand })}</p>
    </div>
  );
}

/** Un champ obligatoire manquant bloque la publication : on dit lequel. */
function Manquant({ manquant, t }: { manquant: string[]; t: Traducteur }) {
  if (manquant.length === 0) return null;
  return (
    <div className="mt-4 rounded-control bg-teinte-orange px-4 py-3">
      <p className="text-petit font-semibold text-alerte">{t("prestataire.aCompleter")}</p>
      <ul className="mt-1 space-y-0.5">
        {manquant.map((manque) => (
          <li key={manque} className="flex items-center gap-2 text-petit text-alerte">
            <Icone nom="alerte" taille={16} />
            {t(CLE_MANQUE[manque] ?? manque)}
          </li>
        ))}
      </ul>
    </div>
  );
}
