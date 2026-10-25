"use client";

import { DUREES_SEJOUR, ajouterJours, totalSejour, type CleDuree, type Logement } from "@teranga/contracts";
import { formaterDateComplete } from "@/lib/dates";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { formaterPrixVisiteur } from "@/lib/prix";

/**
 * Les clés écrites en toutes lettres, et non composées : le contrôle des clés de
 * texte ne résout pas un `t(`demande.duree${cle}`)`, et une clé qui manquerait
 * s'afficherait telle quelle à l'écran sans que rien ne le dise.
 */
const LIBELLES: Record<CleDuree, string> = {
  troisJours: "demande.dureeTroisJours",
  uneSemaine: "demande.dureeUneSemaine",
  deuxSemaines: "demande.dureeDeuxSemaines",
  troisSemaines: "demande.dureeTroisSemaines",
  unMois: "demande.dureeUnMois",
};

/**
 * La durée du séjour, choisie dans la demande.
 *
 * Le visiteur qui arrive de la fiche a déjà des dates, mais ne sait pas
 * forcément combien de temps il restera : il pense en « une semaine », en « un
 * mois », pas en dates de retour. Chaque choix affiche **son prix total**, pour
 * qu'il compare sans calculer — et le prix change, parce que les propriétaires
 * tarifent la semaine et le mois autrement que la nuit.
 *
 * Le jour d'arrivée ne bouge pas ; c'est le départ qui suit la durée.
 *
 * Le prix affiché est celui que l'API enregistrera : c'est la même fonction,
 * dans les contrats. Il inclut les frais fixes de l'annonce, pour être le total
 * que le visiteur verra à l'étape suivante et non un autre.
 *
 * Quand le visiteur est venu avec des dates qui ne sont aucune de ces cinq
 * durées — quatre nuits, dix —, elles restent proposées, en tête, sous le nom
 * de « mes dates » : les remplacer en silence par la durée la plus proche aurait
 * changé son séjour sans le lui dire.
 */
export function SelecteurDuree({
  logement,
  debut,
  nuits,
  onChoisir,
}: {
  logement: Logement;
  /** Premier jour du séjour, `AAAA-MM-JJ`. */
  debut: string;
  nuits: number;
  onChoisir: (nuits: number) => void;
}) {
  const t = useT();
  const langue = useLangue();

  const frais = logement.fraisFixes ?? [];
  const minimum = logement.sejourMinimum ?? 1;

  const propositions: Array<{ cle: string; nuits: number; libelle: string }> = DUREES_SEJOUR.map(
    (duree) => ({ cle: duree.cle, nuits: duree.nuits, libelle: t(LIBELLES[duree.cle]) }),
  );

  // Les dates venues de la fiche, quand elles ne correspondent à aucune durée.
  if (!propositions.some((p) => p.nuits === nuits)) {
    propositions.push({
      cle: "choisie",
      nuits,
      libelle: t("demande.dureeChoisie", { nuits: t("fiche.nuits", { nombre: nuits }) }),
    });
    propositions.sort((a, b) => a.nuits - b.nuits);
  }

  const fin = ajouterJours(debut, nuits);
  const certainesFermees = propositions.some((p) => p.nuits < minimum);

  return (
    <div className="space-y-2">
      <span id="demande-duree" className="block text-[13px] font-semibold text-encre">
        {t("demande.duree")}
      </span>

      <div
        role="radiogroup"
        aria-labelledby="demande-duree"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {propositions.map((proposition) => {
          const actif = proposition.nuits === nuits;
          const fermee = proposition.nuits < minimum;
          return (
            <button
              key={proposition.cle}
              type="button"
              role="radio"
              aria-checked={actif}
              disabled={fermee}
              data-umami-event="duree-sejour"
              data-umami-event-nuits={proposition.nuits}
              onClick={() => onChoisir(proposition.nuits)}
              className={
                "flex min-h-[52px] flex-col items-center justify-center rounded-[14px] border px-2 py-1.5 text-center transition-colors " +
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire " +
                (actif
                  ? "border-primaire bg-primaire text-white"
                  : fermee
                    ? "cursor-not-allowed border-contour-champ bg-champ/40 text-encre-douce opacity-50"
                    : "border-contour-champ bg-champ/60 text-encre hover:border-primaire/40 hover:bg-surface")
              }
            >
              <span className="text-[13.5px] font-semibold leading-tight">{proposition.libelle}</span>
              <span
                className={
                  "chiffres-tabulaires text-[12.5px] leading-tight " +
                  (actif ? "text-white/85" : "text-encre-douce")
                }
              >
                {formaterPrixVisiteur(totalSejour(logement, proposition.nuits, frais), langue)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-0.5 text-[12.5px] text-encre-douce" aria-live="polite">
        {t("demande.dureeDates", {
          debut: formaterDateComplete(new Date(`${debut}T00:00:00`), langue),
          fin: formaterDateComplete(new Date(`${fin}T00:00:00`), langue),
        })}
        {certainesFermees && ` · ${t("demande.dureeMinimum", { nuits: t("fiche.nuits", { nombre: minimum }) })}`}
      </p>
    </div>
  );
}
