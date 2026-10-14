import { notFound } from "next/navigation";
import Image from "next/image";
import type { CoordonneesLogement, Demande } from "@teranga/contracts";
import { BadgeStatut, Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { OngletsReservation } from "@/features/client/onglets-reservation";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterDateComplete, nombreDeNuits } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { logementParId, obtenirDemande } from "@/mocks/api";
import { VignetteDemande } from "@/components/visiteur/vignette-demande";

/**
 * Détail d'une réservation — maquette de l'espace client, écran 3.
 *
 * Photo, référence, dates, onglets, tableau récapitulatif et contact du
 * prestataire. Les coordonnées ne sont présentes qu'après confirmation : c'est
 * la même règle que sur la fiche, appliquée ici par la donnée elle-même.
 */
export default async function DetailReservation({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const demande = await obtenirDemande(id);
  if (!demande) notFound();

  // Le genre de l'offre est une union : on isole la branche logement avant de
  // lire son identifiant, sinon TypeScript ne peut pas le garantir.
  const offre = demande.offre;
  const logement =
    offre.genre === "logement" ? await logementParId(offre.logementId) : undefined;

  const reserveLe = demande.frise[0]?.horodatage;
  const nuits = nombreDeNuits(new Date(demande.dates.debut), new Date(demande.dates.fin));
  const parNuit = "nuits" in demande.prix ? demande.prix.prixParNuit : undefined;

  return (
    <div className="max-w-[820px]">
      <Lien
        href="/compte/reservations"
        className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
      >
        <Icone nom="retour" taille={16} />
        {t("client.mesReservations")}
      </Lien>

      <div className="relative mt-4 aspect-[16/7] overflow-hidden rounded-card bg-champ">
        <VignetteDemande
            offre={demande.offre}
            alt=""
            sizes="(max-width: 1024px) 100vw, 820px"
            className="object-cover"
          />
        <span className="absolute right-4 top-4">
          <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
        </span>
      </div>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-titre-1 text-encre">{demande.offre.titre}</h1>
          {logement && (
            <p className="mt-1 flex items-center gap-1.5 text-petit text-encre-douce">
              <Icone nom="repere" taille={16} />
              {logement.quartier}, {logement.ville}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-petit text-encre-douce chiffres-tabulaires">
            {t("client.reference", { reference: demande.reference })}
          </p>
          {reserveLe && (
            <p className="mt-0.5 text-petit text-encre-douce chiffres-tabulaires">
              {t("client.reserveLe", {
                date: formaterDateComplete(new Date(reserveLe), langue),
              })}
            </p>
          )}
        </div>
      </header>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-petit text-encre-douce">
        <li className="flex items-center gap-1.5 chiffres-tabulaires">
          <Icone nom="calendrier" taille={16} />
          {formaterDateComplete(new Date(demande.dates.debut), langue)} →{" "}
          {formaterDateComplete(new Date(demande.dates.fin), langue)}
        </li>
        <li className="flex items-center gap-1.5">
          <Icone nom="personnes" taille={16} />
          {t("resultats.voyageurs", { nombre: demande.personnes })}
        </li>
      </ul>

      <div className="mt-7">
        <OngletsReservation
          detail={
            <Details
              demande={demande}
              langue={langue}
              nuits={nuits}
              parNuit={parNuit}
              annonce={
                logement && (
                  <Carte className="flex items-center gap-4 p-4">
                    <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-control bg-champ">
                      <Image
                        src={logement.photos[0].url}
                        alt={logement.photos[0].alt}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-titre-3 text-encre">{logement.titre}</span>
                      <span className="block text-petit text-encre-douce">
                        {logement.quartier}, {logement.ville}
                      </span>
                      <Lien
                        href={`/logements/${logement.slug}`}
                        className="mt-1 inline-block text-petit font-semibold text-primaire underline underline-offset-2"
                      >
                        {t("client.voirAnnonce")}
                      </Lien>
                    </span>
                  </Carte>
                )
              }
            />
          }
          prestataire={<Prestataire demande={demande} langue={langue} />}
        />
      </div>
    </div>
  );
}

function Details({
  demande,
  langue,
  nuits,
  parNuit,
  annonce,
}: {
  demande: Demande;
  langue: Langue;
  nuits: number;
  parNuit?: number;
  annonce?: React.ReactNode;
}) {
  const t = traducteurPour(langue);

  return (
    <div className="space-y-6">
      {annonce && (
        <section>
          <h2 className="mb-3 text-titre-3 text-encre">{t("client.informationsLogement")}</h2>
          {annonce}
        </section>
      )}

      <dl className="divide-y divide-contour rounded-card border border-contour bg-surface">
        <Ligne terme={t("client.dates")}>
          {formaterDateComplete(new Date(demande.dates.debut), langue)} →{" "}
          {formaterDateComplete(new Date(demande.dates.fin), langue)}
          {nuits > 0 && ` (${t("client.nuitsDe", { nombre: nuits })})`}
        </Ligne>
        <Ligne terme={t("client.voyageurs")}>
          {t("resultats.voyageurs", { nombre: demande.personnes })}
        </Ligne>
        {parNuit !== undefined && (
          <Ligne terme={t("client.prixParNuit")}>{formaterPrix(parNuit, langue)}</Ligne>
        )}
        <Ligne terme={t("client.totalEstime")}>{formaterPrix(demande.prix.total, langue)}</Ligne>
        <Ligne terme={t("client.statut")}>
          <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
        </Ligne>
      </dl>

      <p className="text-legende text-encre-douce">{t("resultats.paiementSurPlace")}</p>
    </div>
  );
}

/** Le contact du prestataire n'apparaît qu'une fois la demande confirmée. */
function Prestataire({ demande, langue }: { demande: Demande; langue: Langue }) {
  const t = traducteurPour(langue);
  const coordonnees = demande.coordonnees as CoordonneesLogement | undefined;

  if (!coordonnees) {
    return <Bandeau variante="information">{t("client.prestataireApres")}</Bandeau>;
  }

  return (
    <Carte className="space-y-4 p-5">
      <Detail icone="repere" terme={t("detailDemande.adresse")}>
        {coordonnees.adresseExacte}
      </Detail>
      <Detail icone="telephone" terme={t("detailDemande.telephone")}>
        <a
          href={`tel:${coordonnees.telephone.replace(/\s/g, "")}`}
          className="underline underline-offset-2"
        >
          {coordonnees.telephone}
        </a>
      </Detail>
      {coordonnees.consignesArrivee && (
        <Detail icone="information" terme={t("detailDemande.consignes")}>
          {coordonnees.consignesArrivee}
        </Detail>
      )}
      <a href={`tel:${coordonnees.telephone.replace(/\s/g, "")}`} className="block pt-1">
        <Bouton variante="principal" largeur="pleine" icone="telephone">
          {t("client.contacterPrestataire")}
        </Bouton>
      </a>
    </Carte>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre chiffres-tabulaires">{children}</dd>
    </div>
  );
}

function Detail({
  icone,
  terme,
  children,
}: {
  icone: "repere" | "telephone" | "information";
  terme: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icone nom={icone} taille={20} className="mt-0.5 shrink-0 text-encre-douce" />
      <div>
        <p className="text-petit text-encre-douce">{terme}</p>
        <p className="text-corps text-encre">{children}</p>
      </div>
    </div>
  );
}
