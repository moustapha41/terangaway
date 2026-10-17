"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Clock,
  MapPin,
  Plane,
  User,
} from "lucide-react";
import { Compteur, FeuilleBasse, SelecteurDates, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import type { Langue } from "@/lib/i18n/langues";
import { formaterDateComplete } from "@/lib/dates";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { FENETRE_JEUX, SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import { LIEUX } from "@/mocks/fixtures/vehicules";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { ChampLieu } from "./champ-lieu";
import { situer } from "./zones";

type Onglet = "transfert" | "chauffeur" | "location";

const ONGLETS: {
  cle: Onglet;
  icone: typeof Plane;
  href: string;
}[] = [
  { cle: "transfert", icone: Plane, href: "/transports/resultats?service=trajet-avec-chauffeur" },
  { cle: "chauffeur", icone: Car, href: "/transports/resultats?service=trajet-avec-chauffeur" },
  { cle: "location", icone: CalendarDays, href: "/transports/resultats?service=location-avec-chauffeur" },
];

/**
 * Carte de recherche de la page Transport — maquette `transport/`.
 *
 * Trois besoins : transfert, chauffeur, location. La saisie part dans l'URL
 * vers les écrans déjà en place ; seul le jeu de champs change.
 *
 * Le taxi a quitté cette carte à la demande du client. Ce n'était d'ailleurs
 * pas une recherche : l'écran derrière ne montre aucun véhicule, il estime un
 * prix. Il reste accessible depuis la grille des services.
 */
export function BarreRechercheTransport({
  onglet: ongletImpose,
  nu = false,
}: {
  /**
   * Le besoin, imposé de l'extérieur.
   *
   * Les cartes « Nos services » ouvrent cette même carte de recherche dans une
   * feuille, déjà réglée sur le service choisi : on ne redemande pas de choisir
   * ce qu'on vient de cliquer. Les onglets disparaissent alors.
   */
  onglet?: Onglet;
  /** Sans fond ni ombre : la feuille qui l'accueille en porte déjà. */
  nu?: boolean;
} = {}) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();

  const [onglet, setOnglet] = useState<Onglet>(ongletImpose ?? "transfert");
  const [depart, setDepart] = useState("Aéroport AIBD");
  const [arrivee, setArrivee] = useState("Plateau");
  // Pas de date écrite en dur : « 2026-10-12 » est aujourd'hui une date passée,
  // et elle précède l'ouverture de la fenêtre des Jeux. Toute recherche laissée
  // telle quelle partait sur un jour révolu, que l'écran de résultats affichait
  // sans broncher. On prend le premier jour utile : demain, ou l'ouverture.
  const [date, setDate] = useState(premierJourUtile);
  const [heure, setHeure] = useState("10:00");
  const [passagers, setPassagers] = useState(2);
  const [ville, setVille] = useState("Dakar");
  const [plage, setPlage] = useState<Plage>({ ...SEJOUR_DEFAUT });
  const [feuilleVoyageurs, setFeuilleVoyageurs] = useState(false);

  const etiquettes = etiquettesDates(t, langue);
  const estLocation = onglet === "location";
  const lieux = LIEUX.map((l) => l.valeur);
  // Situés une fois : la liste ne change pas d'un rendu à l'autre.
  const lieuxSitues = situer(LIEUX);

  function rechercher() {
    const cible = ONGLETS.find((o) => o.cle === onglet)?.href ?? "/transports/resultats";
    const [chemin, dejaLa] = cible.split("?");

    if (estLocation) {
      const params = new URLSearchParams({
        ville: ville.trim() || "Dakar",
        passagers: String(passagers),
      });
      if (plage.debut) params.set("debut", plage.debut);
      if (plage.fin) params.set("fin", plage.fin);
      naviguer(`${chemin}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(dejaLa)), ...Object.fromEntries(params) })}`);
      return;
    }

    const quand = date && heure ? `${date}T${heure}` : date;
    const params = new URLSearchParams({ passagers: String(passagers) });

    params.set("depart", depart.trim());
    params.set("arrivee", arrivee.trim());
    if (quand) params.set("quand", quand);
    params.set("bagages", "2");

    naviguer(`${chemin}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(dejaLa)), ...Object.fromEntries(params) })}`);
  }

  return (
    <div
      className={
        nu ? "" : "rounded-[20px] bg-white p-4 shadow-carte sm:p-5 md:p-[22px]"
      }
    >
      {/* Centrés : à trois, ils ne remplissent plus la largeur, et alignés à
          gauche ils laissaient un vide à droite qui déséquilibrait la carte.
          `justify-center` ne gêne pas le défilement sur téléphone, où ils
          débordent de nouveau. */}
      <div
        hidden={Boolean(ongletImpose)}
        className={
          ongletImpose
            ? "hidden"
            : "flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {ONGLETS.map((item) => {
          const IconeOnglet = item.icone;
          const actif = onglet === item.cle;
          return (
            <button
              key={item.cle}
              type="button"
              onClick={() => setOnglet(item.cle)}
              aria-pressed={actif}
              className={
                "flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors " +
                (actif
                  ? "bg-nuit text-white"
                  : "bg-fond text-nuit hover:bg-bordure/60")
              }
            >
              <IconeOnglet strokeWidth={1.7} className="h-[18px] w-[18px]" />
              {t(`transport.onglets.${item.cle}`)}
            </button>
          );
        })}
      </div>

      <form
        className={(ongletImpose ? "" : "mt-5 ") + "space-y-4"}
        onSubmit={(e) => {
          e.preventDefault();
          rechercher();
        }}
      >
        {estLocation ? (
          <div
            className={
              nu
                ? "grid gap-3"
                : "grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_auto]"
            }
          >
            <Champ
              icone={<MapPin strokeWidth={1.6} className="h-5 w-5" />}
              label={t("transport.ville")}
              valeur={ville}
              onChange={setVille}
              liste={["Dakar", "Thiès", "Saly"]}
            />

            {/* Deux cases, pas une. Un seul déclencheur portant « Début — Fin »
                obligeait à comprendre qu'un même bouton servait aux deux bornes.
                Chacune a maintenant la sienne, et montre sa propre date ; le
                calendrier derrière reste unique, et sait laquelle il attend. */}
            <SelecteurDates
              libelle={`${t("transport.debut")} — ${t("transport.fin")}`}
              plage={plage}
              onChange={setPlage}
              etiquettes={etiquettes}
              minimum={FENETRE_JEUX.debut}
              rendreChamp={({ ouvrir }) => (
                <>
                  <CaseDate
                    label={t("transport.debut")}
                    valeur={plage.debut}
                    vide={etiquettes.vide}
                    langue={langue}
                    onClick={() => ouvrir("debut")}
                  />
                  <CaseDate
                    label={t("transport.fin")}
                    valeur={plage.fin}
                    vide={etiquettes.vide}
                    langue={langue}
                    onClick={() => ouvrir("fin")}
                  />
                </>
              )}
            />

            <button
              type="button"
              onClick={() => setFeuilleVoyageurs(true)}
              className="flex h-[70px] items-center gap-4 rounded-xl border border-bordure px-5 text-left transition-colors hover:border-nuit/25"
            >
              <User strokeWidth={1.6} className="h-6 w-6 shrink-0 text-nuit" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-gris">{t("transport.passagers")}</span>
                <span className="block truncate text-[17px] font-semibold text-nuit">
                  {t("recherche.nombreVoyageurs", { nombre: passagers })}
                </span>
              </span>
            </button>
          </div>
        ) : (
          <>
            <div className={nu ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
              {/* Le lieu de prise en charge porte le bouton de localisation ;
                  la destination, non — on ne va pas là où l'on est. */}
              <ChampLieu
                libelle={t("transport.lieuPriseEnCharge")}
                placeholder={t("transport.lieuPlaceholder")}
                valeur={depart}
                onChange={setDepart}
                lieux={lieuxSitues}
                localiser
              />
              <ChampLieu
                libelle={t("transport.destination")}
                placeholder={t("transport.lieuPlaceholder")}
                valeur={arrivee}
                onChange={setArrivee}
                lieux={lieuxSitues}
              />
            </div>

            <div className={nu ? "grid gap-3" : "grid gap-3 sm:grid-cols-3"}>
              <label className="flex h-[70px] cursor-pointer items-center gap-4 rounded-xl border border-bordure px-5 transition-colors hover:border-nuit/25">
                <CalendarDays strokeWidth={1.6} className="h-6 w-6 shrink-0 text-nuit" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-gris">{t("transport.date")}</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent text-[17px] font-semibold text-nuit outline-none chiffres-tabulaires"
                    required
                  />
                </span>
              </label>

              <label className="flex h-[70px] cursor-pointer items-center gap-4 rounded-xl border border-bordure px-5 transition-colors hover:border-nuit/25">
                <Clock strokeWidth={1.6} className="h-6 w-6 shrink-0 text-nuit" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-gris">{t("transport.heure")}</span>
                  <input
                    type="time"
                    value={heure}
                    onChange={(e) => setHeure(e.target.value)}
                    className="w-full bg-transparent text-[17px] font-semibold text-nuit outline-none chiffres-tabulaires"
                    required
                  />
                </span>
              </label>

              <button
                type="button"
                onClick={() => setFeuilleVoyageurs(true)}
                className="flex h-[70px] items-center gap-4 rounded-xl border border-bordure px-5 text-left transition-colors hover:border-nuit/25"
              >
                <User strokeWidth={1.6} className="h-6 w-6 shrink-0 text-nuit" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-gris">{t("transport.passagers")}</span>
                  <span className="block truncate text-[17px] font-semibold text-nuit">
                    {t("recherche.nombreVoyageurs", { nombre: passagers })}
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        <FeuilleBasse
          ouverte={feuilleVoyageurs}
          onFermer={() => setFeuilleVoyageurs(false)}
          titre={t("transport.passagers")}
          etiquetteFermer={t("demande.fermer")}
        >
          <div className="px-1 pb-2">
            <Compteur
              libelle={t("transport.passagers")}
              valeur={passagers}
              min={1}
              max={14}
              onChange={setPassagers}
            />
          </div>
        </FeuilleBasse>

        <button
          type="submit"
          className="flex h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-nuit text-[16px] font-semibold text-white transition-colors hover:bg-nuit-clair"
        >
          {t("transport.rechercherTrajet")}
          <ArrowRight strokeWidth={2} className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

function Champ({
  icone,
  label,
  valeur,
  onChange,
  liste,
}: {
  icone: React.ReactNode;
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  liste: string[];
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="flex h-[70px] cursor-text items-center gap-4 rounded-xl border border-bordure px-5 transition-colors focus-within:border-nuit/40 hover:border-nuit/25">
      <span className="shrink-0 text-nuit">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-gris">{label}</span>
        <input
          list={id}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          className="w-full truncate bg-transparent text-[17px] font-semibold text-nuit outline-none"
          required
        />
        <datalist id={id}>
          {liste.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </span>
    </label>
  );
}

/** Demain, ou l'ouverture de la fenêtre des Jeux si elle est encore à venir. */
function premierJourUtile(): string {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const jour = demain.toISOString().slice(0, 10);
  return jour < FENETRE_JEUX.debut ? FENETRE_JEUX.debut : jour;
}

/** Une borne de la période de location : son intitulé, sa date, son ouverture. */
function CaseDate({
  label,
  valeur,
  vide,
  langue,
  onClick,
}: {
  label: string;
  valeur?: string;
  vide: string;
  langue: Langue;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[70px] items-center gap-4 rounded-xl border border-bordure px-5 text-left transition-colors hover:border-nuit/25"
    >
      <CalendarDays strokeWidth={1.6} className="h-6 w-6 shrink-0 text-nuit" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-gris">{label}</span>
        <span
          className={
            "block truncate text-[17px] font-semibold " +
            (valeur ? "text-nuit chiffres-tabulaires" : "text-gris")
          }
        >
          {valeur ? formaterDateComplete(new Date(`${valeur}T00:00:00`), langue) : vide}
        </span>
      </span>
    </button>
  );
}
