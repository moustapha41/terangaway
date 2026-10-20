import Image from "next/image";
import type { Demande } from "@teranga/contracts";
import { BadgeStatut, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { formaterDateComplete } from "@/lib/dates";
import { formaterPrixVisiteur } from "@/lib/prix";
import { VignetteDemande } from "@/components/visiteur/vignette-demande";
import { titreOffre } from "@/lib/i18n/titre-logement";

/**
 * Carte de réservation — maquette du tableau de bord et de « Mes réservations ».
 *
 * Logement et transport partagent la même carte : pour le visiteur, c'est un
 * seul séjour. Seule la ligne de dates change de forme — un transport a une
 * heure de prise en charge, pas une plage de nuits.
 */
export function CarteReservation({
  demande,
  langue,
  compacte,
}: {
  demande: Demande;
  langue: Langue;
  compacte?: boolean;
}) {
  const t = traducteurPour(langue);
  const transport = demande.offre.genre === "vehicule";
  const parNuit = "nuits" in demande.prix;

  return (
    <Carte className={compacte ? "" : "transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]"}>
      <div className={compacte ? "p-4" : "flex flex-col gap-4 p-4 sm:flex-row"}>
        <div
          className={
            "relative shrink-0 overflow-hidden rounded-control bg-champ " +
            (compacte ? "aspect-[16/10] w-full" : "h-[110px] w-full sm:w-[150px]")
          }
        >
          <VignetteDemande
            offre={demande.offre}
            alt=""
            sizes="80px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-titre-3 text-encre">{titreOffre(demande.offre, t)}</p>
            <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
          </div>

          <ul className="mt-2 space-y-1 text-petit text-encre-douce">
            <li className="flex items-center gap-1.5 chiffres-tabulaires">
              <Icone nom="calendrier" taille={16} className="shrink-0" />
              {transport ? (
                <>
                  {formaterDateComplete(new Date(demande.dates.debut), langue)}
                  {demande.heureArrivee ? ` · ${demande.heureArrivee}` : ""}
                </>
              ) : (
                <>
                  {formaterDateComplete(new Date(demande.dates.debut), langue)} →{" "}
                  {formaterDateComplete(new Date(demande.dates.fin), langue)}
                </>
              )}
            </li>
            <li className="flex items-center gap-1.5">
              <Icone nom="personnes" taille={16} className="shrink-0" />
              {t("resultats.voyageurs", { nombre: demande.personnes })}
            </li>
          </ul>

          <p className="mt-3 text-prix text-encre chiffres-tabulaires">
            {formaterPrixVisiteur(
              parNuit ? (demande.prix as { prixParNuit: number }).prixParNuit : demande.prix.total,
              langue,
            )}
            {parNuit && (
              <span className="ml-1 text-petit font-normal text-encre-douce">
                {t("commun.parNuit")}
              </span>
            )}
          </p>

          <div className="mt-3">
            <Lien
              href={`/compte/reservations/${demande.id}`}
              className="flex min-h-[var(--size-control)] items-center justify-center rounded-control bg-champ px-4 text-petit font-semibold text-encre transition-colors hover:bg-contour/60"
            >
              {t("client.voirDetails")}
            </Lien>
          </div>
        </div>
      </div>
    </Carte>
  );
}
