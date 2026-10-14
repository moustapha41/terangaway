import Image from "next/image";
import type { Demande } from "@teranga/contracts";
import { BadgeStatut, Carte, Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";
import { dureeRestante, formaterPlage } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { VignetteDemande } from "@/components/visiteur/vignette-demande";

/**
 * Carte de demande — une ligne de « Mes demandes » (§C.3) : vignette, titre,
 * dates, statut, action attendue.
 *
 * L'action attendue est la raison d'être de la carte : un statut seul ne dit pas
 * au visiteur ce qu'il doit faire (§A.8, « dire quoi faire ensuite »).
 */
export function CarteDemande({ demande, langue }: { demande: Demande; langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
      <Lien href={`/mes-demandes/${demande.id}`} className="flex gap-4 p-4">
        <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control bg-champ">
          <VignetteDemande
            offre={demande.offre}
            alt=""
            sizes="80px"
            className="object-cover"
          />
        </span>

        <span className="min-w-0 flex-1">
          <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />

          <span className="mt-2 block text-titre-3 text-encre">
            {demande.offre.titre}
          </span>

          <span className="mt-1 block text-petit text-encre-douce chiffres-tabulaires">
            {formaterPlage(new Date(demande.dates.debut), new Date(demande.dates.fin), langue)}
          </span>

          <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-petit font-semibold text-encre chiffres-tabulaires">
              {formaterPrix(demande.prix.total, langue)}
            </span>

            {demande.expireLe && (
              <span className="inline-flex items-center gap-1 text-petit text-alerte">
                <Icone nom="horloge" taille={16} />
                {t("mesDemandes.expireDans", {
                  duree: dureeRestante(new Date(demande.expireLe), langue),
                })}
              </span>
            )}
          </span>
        </span>

        <Icone nom="chevron-droite" taille={20} className="shrink-0 self-center text-encre-douce" />
      </Lien>
    </Carte>
  );
}
