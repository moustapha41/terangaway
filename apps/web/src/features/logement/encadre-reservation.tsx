"use client";

import { useState } from "react";
import { lieuDeSejour, lienTransfert, type Logement } from "@teranga/contracts";
import { Bouton, Compteur, FeuilleBasse, Icone, SelecteurDates, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { FENETRE_JEUX } from "@/lib/dates/sejour";
import { formaterDateComplete, nombreDeNuits } from "@/lib/dates";
import { formaterPrixVisiteur, prixAffiche, totalSejour } from "@/lib/prix";
import { ConversionPrix } from "@/components/visiteur/conversion-prix";
import { lienWhatsapp } from "@/lib/assistance";
import { titreLogement } from "@/lib/i18n/titre-logement";
import { Lien } from "@/lib/i18n/lien";
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
  transfertDes,
}: {
  logement: Logement;
  debut: string;
  fin: string;
  personnes: number;
  /** Le plus bas prix de transfert, en francs, quand le catalogue le dit. */
  transfertDes?: number;
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

  /**
   * La conversation, déjà écrite : ce logement, ces dates, ce nombre de
   * voyageurs. Elle arrive à l'équipe qualifiée — une demande précise, pas un
   * « bonjour » — et suit les dates **courantes** de l'encadré, pas celles de
   * l'adresse.
   */
  const message =
    plage.debut && plage.fin
      ? t("whatsapp.logement", {
          titre: titreLogement(logement, t),
          debut: formaterDateComplete(new Date(`${plage.debut}T00:00:00`), langue),
          fin: formaterDateComplete(new Date(`${plage.fin}T00:00:00`), langue),
          personnes: voyageurs,
        })
      : t("whatsapp.logementSansDates", { titre: titreLogement(logement, t) });
  const lienDiscussion = lienWhatsapp(message);

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
        <ConversionPrix
          montant={prixAffiche(logement).montant}
          unite={t(prixAffiche(logement).cleUnite)}
        />
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

          {/* Sous `lg`, la barre est étroite : une icône seule, à côté. */}
          <a
            href={lienDiscussion}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("whatsapp.bouton")}
            data-umami-event="whatsapp-fiche"
            className="flex h-[var(--size-control,48px)] w-[var(--size-control,48px)] shrink-0 items-center justify-center rounded-pill bg-succes text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-succes lg:hidden"
          >
            <Icone nom="whatsapp" taille={24} />
          </a>
        </div>

        {/* À partir de `lg`, le bouton a la place de se nommer. */}
        <a
          href={lienDiscussion}
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="whatsapp-fiche"
          className="mt-2.5 hidden h-[var(--size-control,48px)] items-center justify-center gap-2 rounded-pill border border-succes px-4 text-[15px] font-semibold text-succes transition-colors hover:bg-teinte-vert focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-succes lg:flex"
        >
          <Icone nom="whatsapp" taille={20} />
          {t("whatsapp.bouton")}
        </a>

        <p className="mt-3 hidden items-center justify-center gap-1.5 text-legende text-encre-douce lg:flex">
          <Icone nom="information" taille={16} />
          {t("fiche.aucunPaiement")}
        </p>

        {/* L'arrivée, avant même la décision. Le lien suit les dates et les
            voyageurs **courants** de l'encadré, pas ceux de l'adresse : le
            visiteur qui vient de les changer ne doit pas être envoyé chercher
            un chauffeur pour un autre jour. Sous `lg` l'encadré est une barre
            d'action sans dates modifiables : la ligne n'y a pas sa place, et
            l'écran de confirmation prend le relais. */}
        {transfertDes !== undefined && plage.debut && plage.fin && (
          <Lien
            href={lienTransfert({
              sens: "arrivee",
              lieu: lieuDeSejour(logement),
              debut: plage.debut,
              fin: plage.fin,
              personnes: voyageurs,
            })}
            data-umami-event="fiche-transfert"
            className="mt-3 hidden items-center justify-center gap-1.5 rounded-control border border-contour px-3 py-2 text-legende font-semibold text-encre transition-colors hover:border-primaire/40 hover:bg-champ lg:flex"
          >
            <Icone nom="avion" taille={16} className="text-primaire" />
            {t("fiche.transfertDes", { prix: formaterPrixVisiteur(transfertDes, langue) })}
          </Lien>
        )}
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
