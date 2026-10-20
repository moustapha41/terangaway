import { notFound } from "next/navigation";
import type { Logement } from "@teranga/contracts";
import { Bandeau, Icone, type NomIcone } from "@teranga/ui";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { CarteHote } from "@/components/visiteur/carte-hote";
import { GalerieMosaique } from "@/components/visiteur/galerie-mosaique";
import { VisiteFilmee } from "@/components/visiteur/visite-filmee";
import { EncadreReservation } from "@/features/logement/encadre-reservation";
import { OngletsFiche } from "@/features/logement/onglets-fiche";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { titreLogement } from "@/lib/i18n/titre-logement";
import { SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import { avisLogement, obtenirLogement } from "@/mocks/api";

/**
 * Écran 3 · Fiche logement — maquette du parcours logement, écran 03.
 *
 * Mosaïque de photos, titre et note, caractéristiques, équipements, onglets,
 * encadré de réservation et carte de l'hôte.
 *
 * Ce que cet écran **ne peut pas** afficher reste inchangé : l'adresse exacte et
 * le téléphone n'existent pas dans le type `Logement`. La maquette montre un
 * bouton « Contacter l'hôte » ; il mène à la demande, pas à un numéro.
 */
export default async function FicheLogement({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale, slug } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const recherche = await searchParams;
  const t = traducteurPour(langue);

  const logement = await obtenirLogement(slug, langue);
  if (!logement) notFound();

  const debut = recherche.debut ?? SEJOUR_DEFAUT.debut;
  const fin = recherche.fin ?? SEJOUR_DEFAUT.fin;
  const personnes = Number(recherche.personnes ?? 2);
  const avis = await avisLogement(slug, logement.nombreAvis ?? 0);

  const visiteSeule =
    logement.photosDeLaVisite === true && (logement.videos?.length ?? 0) > 0;

  return (
    <main className="bg-page pb-[calc(200px+env(safe-area-inset-bottom))] lg:pb-16">
      <EnTeteSession />

      <div className="mx-auto w-[92%] max-w-[1260px] pt-5">
        <nav aria-label={t("resultats.filAriane")} className="mb-4 text-petit text-encre-douce">
          <Lien href="/" className="hover:text-encre">
            {t("resultats.filAriane")}
          </Lien>
          <span className="mx-2">›</span>
          <Lien href="/logements" className="hover:text-encre">
            {t("resultats.filLogement")}
          </Lien>
          <span className="mx-2">›</span>
          <span className="text-encre">{titreLogement(logement, t)}</span>
        </nav>

        {/* Quand les « photos » ne sont que des trames de la visite, c'est la
            visite qui occupe la place : la mosaïque n'apporterait rien. */}
        {visiteSeule ? (
          <VisiteFilmee videos={logement.videos!} langue={langue} principale />
        ) : (
          <GalerieMosaique photos={logement.photos} logementId={logement.id} verifie={logement.verifie} />
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-8">
            <header>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titre-1 text-encre">{titreLogement(logement, t)}</h1>
                {logement.note !== undefined && (
                  <p className="flex items-center gap-1.5 text-corps text-encre">
                    <Etoile />
                    <span className="font-semibold chiffres-tabulaires">
                      {logement.note.toFixed(1).replace(".", langue === "en" ? "." : ",")}
                    </span>
                    <span className="text-encre-douce">
                      ({t("resultats.avis", { nombre: logement.nombreAvis ?? 0 })})
                    </span>
                  </p>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-corps text-encre-douce">
                <Icone nom="repere" taille={20} className="shrink-0" />
                {logement.quartier}, {logement.ville}
              </p>
            </header>

            {/* Caractéristiques, en boîtes : ce sont les quatre chiffres qui décident. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Caracteristique icone="personnes">
                {t("resultats.voyageurs", { nombre: logement.capacite })}
              </Caracteristique>
              <Caracteristique icone="lit">
                {t("resultats.chambres", { nombre: logement.chambres })}
              </Caracteristique>
              <Caracteristique icone="salle-de-bain">
                {t("resultats.sallesDeBain", { nombre: logement.sallesDeBain })}
              </Caracteristique>
              <Caracteristique icone={iconeEquipement(logement.equipements[0])}>
                {t(`equipement.${logement.equipements[0]}`)}
              </Caracteristique>
            </ul>

            <ul className="flex flex-wrap gap-2">
              {logement.equipements.map((equipement) => (
                <li
                  key={equipement}
                  className="inline-flex items-center gap-2 rounded-control bg-champ px-3 py-2 text-petit text-encre"
                >
                  <Icone nom={iconeEquipement(equipement)} taille={20} className="text-encre-douce" />
                  {t(`equipement.${equipement}`)}
                </li>
              ))}
            </ul>

            {!visiteSeule && logement.videos && logement.videos.length > 0 && (
              <VisiteFilmee videos={logement.videos} langue={langue} />
            )}

            <OngletsFiche logement={logement} avis={avis} />

            <Bandeau variante="information">{t("fiche.adresseMasquee")}</Bandeau>
          </div>

          <div className="min-w-0 space-y-5 lg:sticky lg:top-6">
            <EncadreReservation
              logement={logement}
              debut={debut}
              fin={fin}
              personnes={personnes}
            />
            <CarteHote partenaire={logement.partenaire} logementId={logement.id} langue={langue} />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Correspondance équipement → icône du jeu unique. */
function iconeEquipement(equipement: Logement["equipements"][number]): NomIcone {
  // Chaque équipement a désormais son icône dans le jeu unique ; seuls parking
  // et gardien empruntent une icône voisine, faute d'équivalent dédié.
  const table: Record<string, NomIcone> = { parking: "voiture", gardien: "verification" };
  return table[equipement] ?? (equipement as NomIcone);
}

function Caracteristique({
  icone,
  children,
}: {
  icone: NomIcone;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-card border border-contour bg-surface px-3 py-4 text-center">
      <Icone nom={icone} taille={24} className="text-encre-douce" />
      <span className="text-petit text-encre">{children}</span>
    </li>
  );
}

function Etoile() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#F4B942">
      <path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8Z" />
    </svg>
  );
}
