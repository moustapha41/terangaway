import { Carte, Icone } from "@teranga/ui";
import { CarteReservation } from "@/components/client/carte-reservation";
import { CarteAide } from "@/components/client/carte-aide";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { listerDemandes } from "@/mocks/api";

/**
 * Mes réservations — maquette de l'espace client, écran 2.
 *
 * Un seul jeu de données pour « réservations » et « demandes » : une demande
 * **est** la réservation, à son statut près. La maquette sépare les deux
 * entrées ; ce sont donc deux vues filtrées du même catalogue, pas deux listes
 * qui finiraient par diverger.
 */
const FILTRES = [
  { cle: "toutes", statuts: null },
  { cle: "confirmees", statuts: ["confirmee", "terminee"] },
  { cle: "enAttente", statuts: ["envoyee", "acceptee"] },
  { cle: "annulees", statuts: ["annulee", "refusee", "expiree"] },
] as const;

export default async function Reservations({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { filtre } = await searchParams;
  const t = traducteurPour(langue);

  const toutes = await listerDemandes();
  const actif = FILTRES.find((f) => f.cle === filtre) ?? FILTRES[0];
  const visibles = actif.statuts
    ? toutes.filter((d) => (actif.statuts as readonly string[]).includes(d.statut))
    : toutes;

  return (
    <div className="grid gap-8 xl:grid-cols-[1.7fr_1fr] xl:items-start">
      <div>
        <h1 className="text-titre-1 text-encre">{t("client.mesReservations")}</h1>

        <div role="group" aria-label={t("client.filtres")} className="mt-5 flex flex-wrap gap-2">
          {FILTRES.map((f) => {
            const nombre = f.statuts
              ? toutes.filter((d) => (f.statuts as readonly string[]).includes(d.statut)).length
              : toutes.length;
            const selectionne = f.cle === actif.cle;
            return (
              <Lien
                key={f.cle}
                href={f.cle === "toutes" ? "/compte/reservations" : `/compte/reservations?filtre=${f.cle}`}
                aria-current={selectionne ? "true" : undefined}
                className={
                  "inline-flex min-h-[var(--size-touch)] items-center rounded-pill border px-4 text-petit font-semibold chiffres-tabulaires " +
                  (selectionne
                    ? "border-primaire bg-primaire text-white"
                    : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
                }
              >
                {t(`client.${f.cle}`)} ({nombre})
              </Lien>
            );
          })}
        </div>

        {visibles.length === 0 ? (
          <Carte className="mt-6 px-6 py-12 text-center">
            <Icone nom="calendrier" taille={32} className="mx-auto text-encre-douce" />
            <h2 className="mt-4 text-titre-2 text-encre">{t("client.aucuneReservation")}</h2>
            <p className="mx-auto mt-2 max-w-[44ch] text-corps text-encre-douce">
              {t("client.aucuneReservationTexte")}
            </p>
          </Carte>
        ) : (
          <ul className="mt-6 space-y-4">
            {visibles.map((demande) => (
              <li key={demande.id}>
                <CarteReservation demande={demande} langue={langue} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <CarteAide t={t} />
    </div>
  );
}
