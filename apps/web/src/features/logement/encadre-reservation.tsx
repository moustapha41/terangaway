"use client";

import { useState } from "react";
import type { Logement } from "@teranga/contracts";
import { Bouton, Compteur, FeuilleBasse, Icone, SelecteurDates, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { FENETRE_JEUX } from "@/lib/dates/sejour";
import { formaterDateComplete, nombreDeNuits } from "@/lib/dates";
import { formaterPrixVisiteur, prixAffiche, totalSejour } from "@/lib/prix";
import { useNaviguer } from "@/lib/i18n/naviguer";

/**
 * Encadré de réservation — maquette écran 03, colonne de droite.
 *
 * Il remplace la barre d'action du dossier de conception sur ordinateur, et la
 * redevient sous `lg` : un seul élément fixe en bas d'écran (§B.6).
 *
 * Les dates et le nombre de voyageurs sont modifiables ici : le visiteur qui
 * arrive par un lien partagé doit pouvoir ajuster son séjour sans repartir de la
 * recherche. Le total se recalcule à chaque changement.
 */
export function EncadreReservation({
  logement,
  debut,
  fin,
  personnes,
}: {
  logement: Logement;
  debut: string;
  fin: string;
  personnes: number;
}) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();

  const [plage, setPlage] = useState<Plage>({ debut, fin });
  const [voyageurs, setVoyageurs] = useState(personnes);
  const [feuille, setFeuille] = useState(false);

  const nuits =
    plage.debut && plage.fin
      ? nombreDeNuits(new Date(`${plage.debut}T00:00:00`), new Date(`${plage.fin}T00:00:00`)) || 1
      : 1;

  const fraisFixes = logement.fraisFixes ?? [];
  const total = totalSejour(logement, nuits, fraisFixes);

  /**
   * Quelques appartements de Dakar ne se louent qu'au mois. Leur afficher un
   * total pour sept nuits proposerait un séjour que le propriétaire ne fait
   * pas : c'est le loyer qui s'annonce, et la durée minimale avec lui.
   */
  const auMois = logement.seulementAuMois === true && logement.prixParMois !== undefined;

  const demander = () => {
    const params = new URLSearchParams({ personnes: String(voyageurs) });
    if (plage.debut) params.set("debut", plage.debut);
    if (plage.fin) params.set("fin", plage.fin);
    naviguer(`/demande/${logement.id}?${params.toString()}`);
  };

  return (
    <aside
      className={
        "fixed inset-x-0 bottom-0 z-30 border-t border-contour bg-surface p-4 " +
        "pb-[max(1rem,env(safe-area-inset-bottom))] " +
        "shadow-[0_-8px_24px_-16px_rgb(2_20_38/0.4)] " +
        "lg:static lg:rounded-card lg:border lg:p-6 lg:pb-6 lg:shadow-none"
      }
    >
      <div className="mx-auto w-[92%] max-w-[1260px] lg:w-full">
        <p className="text-prix text-encre chiffres-tabulaires">
          {formaterPrixVisiteur(prixAffiche(logement).montant, langue)}
          <span className="ml-1 text-petit font-normal text-encre-douce">
            {t(prixAffiche(logement).cleUnite)}
          </span>
        </p>
        <p className="mt-0.5 text-petit text-encre-douce chiffres-tabulaires">
          {formaterPrixVisiteur(logement.prixParNuit, langue)} {t("commun.parNuit")}
        </p>
        <p className="mt-0.5 text-petit text-encre-douce chiffres-tabulaires">
          {auMois
            ? t("fiche.sejourAuMois", {
                nuits: t("fiche.nuits", { nombre: logement.sejourMinimum ?? 30 }),
              })
            : t("resultats.totalNuits", {
                prix: formaterPrixVisiteur(total, langue),
                nuits: t("fiche.nuits", { nombre: nuits }),
              })}
        </p>

        {/* Dates et voyageurs : masqués sous lg, où la barre reste une barre d'action. */}
        <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-2">
          <SelecteurDates
            libelle={t("fiche.debut")}
            plage={plage}
            onChange={setPlage}
            minimum={FENETRE_JEUX.debut}
            etiquettes={etiquettesDates(t, langue)}
            // Les deux boîtes ouvrent le même calendrier : début et fin sont
            // une seule plage, pas deux champs indépendants.
            rendreChamp={({ ouvrir }) => (
              <>
                <Boite onClick={() => ouvrir("debut")} icone="calendrier" label={t("fiche.debut")}>
                  {plage.debut ? formaterDateComplete(new Date(`${plage.debut}T00:00:00`), langue) : "—"}
                </Boite>
                <Boite onClick={() => ouvrir("fin")} icone="calendrier" label={t("fiche.fin")}>
                  {plage.fin ? formaterDateComplete(new Date(`${plage.fin}T00:00:00`), langue) : "—"}
                </Boite>
              </>
            )}
          />
        </div>

        <div className="mt-3 hidden lg:block">
          <Boite onClick={() => setFeuille(true)} icone="personnes" label={t("recherche.voyageurs")} chevron>
            {t("recherche.nombreVoyageurs", { nombre: voyageurs })}
          </Boite>
        </div>

        <div className="mt-4 flex items-center gap-4 lg:mt-5 lg:block">
          <Bouton variante="principal" largeur="pleine" onClick={demander}>
            {t("fiche.demander")}
          </Bouton>
        </div>

        <p className="mt-3 hidden items-center justify-center gap-1.5 text-legende text-encre-douce lg:flex">
          <Icone nom="information" taille={16} />
          {t("fiche.aucunPaiement")}
        </p>
      </div>

      <FeuilleBasse
        ouverte={feuille}
        onFermer={() => setFeuille(false)}
        titre={t("recherche.voyageurs")}
        etiquetteFermer={t("demande.fermer")}
      >
        <div className="space-y-5">
          <Compteur
            libelle={t("recherche.voyageurs")}
            valeur={voyageurs}
            min={1}
            max={logement.capacite}
            onChange={setVoyageurs}
          />
          <Bouton variante="principal" largeur="pleine" onClick={() => setFeuille(false)}>
            {t("recherche.valider")}
          </Bouton>
        </div>
      </FeuilleBasse>
    </aside>
  );
}

function Boite({
  onClick,
  icone,
  label,
  chevron,
  children,
}: {
  onClick: () => void;
  icone: "calendrier" | "personnes";
  label: string;
  chevron?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-control border border-contour-champ px-3 py-2 text-left transition-colors hover:border-primaire/40"
    >
      <Icone nom={icone} taille={20} className="shrink-0 text-encre-douce" />
      <span className="min-w-0 flex-1">
        <span className="block text-legende text-encre-douce">{label}</span>
        <span className="block truncate text-petit font-semibold text-encre chiffres-tabulaires">
          {children}
        </span>
      </span>
      {chevron && <Icone nom="chevron" taille={20} className="shrink-0 text-encre-douce" />}
    </button>
  );
}
