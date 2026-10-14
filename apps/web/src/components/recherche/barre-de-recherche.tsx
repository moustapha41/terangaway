"use client";

import { useId, useState } from "react";
import {
  CalendarDays,
  Car,
  ChevronDown,
  House,
  MapPin,
  Search,
  User,
} from "lucide-react";
import { Bouton, Compteur, FeuilleBasse, SelecteurDates, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { formaterDateComplete } from "@/lib/dates";
import { FENETRE_JEUX, SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import { LIEUX } from "@/mocks/fixtures/vehicules";
import { VILLES } from "@/mocks/fixtures/logements";
import { useNaviguer } from "@/lib/i18n/naviguer";

type Onglet = "logements" | "transports";

/**
 * Barre de recherche de l'accueil.
 *
 * L'allure est celle de la maquette au pixel ; ce qui a changé, c'est que les
 * trois champs marchent vraiment. Ils s'appuient sur les composants du design
 * system — le calendrier et le compteur sont ceux de `@teranga/ui`, pas des
 * copies — mais avec le déclencheur de la maquette plutôt que le leur.
 *
 * La recherche n'a besoin d'aucun serveur : tout part dans l'URL, et l'écran de
 * résultats interroge les mocks. Le jour où l'API arrive, rien ne bouge ici.
 *
 * Le formulaire a une vraie `action` en GET et des champs nommés : il fonctionne
 * **avant l'hydratation** et sans JavaScript du tout. Sans ça, un clic sur
 * « Rechercher » pendant le chargement rechargeait l'accueil en perdant la saisie
 * — ce qui arrive pour de bon sur un téléphone en 3G.
 */
export function BarreDeRecherche({
  variante = "accueil",
}: {
  /**
   * « accueil » : les deux onglets logement / transport, dates en un champ.
   * « logement » : pas d'onglets, arrivée et départ séparés — maquette écran 01.
   */
  variante?: "accueil" | "logement";
} = {}) {
  const sansOnglets = variante === "logement";
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();
  const idListe = useId();

  const [onglet, setOnglet] = useState<Onglet>("logements");
  const [destination, setDestination] = useState("Dakar");
  const [plage, setPlage] = useState<Plage>({ ...SEJOUR_DEFAUT });
  const [voyageurs, setVoyageurs] = useState(2);
  const [feuilleVoyageurs, setFeuilleVoyageurs] = useState(false);

  const etiquettes = etiquettesDates(t, langue);
  const lieux = onglet === "logements" ? VILLES : LIEUX;

  function rechercher() {
    const params = new URLSearchParams({ personnes: String(voyageurs) });
    if (destination.trim()) params.set("ville", destination.trim());
    if (plage.debut) params.set("debut", plage.debut);
    if (plage.fin) params.set("fin", plage.fin);

    // Le transport n'a qu'un besoin qui prend ville, période et passagers :
    // la location avec chauffeur. Les deux autres demandent un trajet précis,
    // que cette barre ne saisit pas — le visiteur les choisit sur /transports.
    if (onglet === "transports") {
      params.set("passagers", String(voyageurs));
      naviguer(`/transports/location?${params.toString()}`);
      return;
    }
    naviguer(`/logements?${params.toString()}`);
  }

  return (
    <form
      action={`/${langue}/logements`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        rechercher();
      }}
      className="rounded-[20px] bg-white p-[18px] shadow-carte"
    >
      {/* Portés par le formulaire lui-même, pour la soumission sans JavaScript. */}
      <input type="hidden" name="debut" value={plage.debut ?? ""} />
      <input type="hidden" name="fin" value={plage.fin ?? ""} />
      <input type="hidden" name="personnes" value={voyageurs} />
      {/* onglets */}
      <div
        hidden={sansOnglets}
        role="tablist"
        aria-label={t("recherche.etiquetteOnglets")}
        className={sansOnglets ? "hidden" : "flex overflow-hidden rounded-xl md:w-fit"}
      >
        <Onglet
          actif={onglet === "logements"}
          onClick={() => setOnglet("logements")}
          icone={<House strokeWidth={1.6} className="h-[19px] w-[19px] shrink-0 md:h-[21px] md:w-[21px]" />}
          libelle={t("recherche.logements")}
        />
        <Onglet
          actif={onglet === "transports"}
          onClick={() => setOnglet("transports")}
          icone={<Car strokeWidth={1.6} className="h-[19px] w-[19px] shrink-0 md:h-[21px] md:w-[21px]" />}
          libelle={t("recherche.transports")}
        />
      </div>

      {/* champs */}
      <div className={(sansOnglets ? "" : "mt-5 ") + "grid gap-[17px] " + (sansOnglets ? "md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" : "md:grid-cols-[1fr_1fr_1fr_auto]")}>
        {/* Destination : un vrai champ, avec la liste des lieux connus puis
            saisie libre — le `<datalist>` du navigateur, comme SelecteurLieu. */}
        <Cadre icone={<MapPin strokeWidth={1.6} className="h-[24px] w-[24px]" />}>
          <label htmlFor={`${idListe}-ville`} className="block text-[13px] text-gris">
            {t("recherche.destination")}
          </label>
          <input
            id={`${idListe}-ville`}
            name="ville"
            list={idListe}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t("transport.lieuPlaceholder")}
            autoComplete="off"
            className="block w-full truncate bg-transparent text-[17px] font-semibold text-nuit outline-none placeholder:font-normal placeholder:text-gris"
          />
          <datalist id={idListe}>
            {lieux.map((lieu) => (
              <option key={lieu.valeur} value={lieu.valeur}>
                {lieu.detail}
              </option>
            ))}
          </datalist>
        </Cadre>

        {/* Dates : le calendrier du design system, déclenché par le champ de la maquette. */}
        <SelecteurDates
          libelle={t("recherche.dates")}
          plage={plage}
          onChange={setPlage}
          etiquettes={etiquettes}
          minimum={FENETRE_JEUX.debut}
          rendreChamp={({ ouvrir, resume }) =>
            sansOnglets ? (
              <>
                <CadreBouton
                  onClick={ouvrir}
                  icone={<CalendarDays strokeWidth={1.6} className="h-[24px] w-[24px]" />}
                  label={t("fiche.arrivee")}
                  valeur={plage.debut ? formaterDateComplete(new Date(`${plage.debut}T00:00:00`), langue) : "—"}
                  vide={!plage.debut}
                  tabulaire
                />
                <CadreBouton
                  onClick={ouvrir}
                  icone={<CalendarDays strokeWidth={1.6} className="h-[24px] w-[24px]" />}
                  label={t("fiche.depart")}
                  valeur={plage.fin ? formaterDateComplete(new Date(`${plage.fin}T00:00:00`), langue) : "—"}
                  vide={!plage.fin}
                  tabulaire
                />
              </>
            ) : (
              <CadreBouton
                onClick={ouvrir}
                icone={<CalendarDays strokeWidth={1.6} className="h-[24px] w-[24px]" />}
                label={t("recherche.dates")}
                valeur={resume ?? etiquettes.vide}
                vide={!resume}
                tabulaire
              />
            )
          }
        />

        {/* Voyageurs : compteur en feuille basse. */}
        <CadreBouton
          onClick={() => setFeuilleVoyageurs(true)}
          icone={<User strokeWidth={1.6} className="h-[24px] w-[24px]" />}
          label={t("recherche.voyageurs")}
          valeur={t("recherche.nombreVoyageurs", { nombre: voyageurs })}
          chevron
        />

        <button
          type="submit"
          className="flex h-[70px] items-center justify-center gap-3 rounded-xl bg-jaune px-10 text-[17px] font-semibold text-nuit transition-colors hover:bg-jaune-vif focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuit md:min-w-[260px]"
        >
          <Search strokeWidth={2.2} className="h-[21px] w-[21px]" />
          {t("recherche.rechercher")}
        </button>
      </div>

      <FeuilleBasse
        ouverte={feuilleVoyageurs}
        onFermer={() => setFeuilleVoyageurs(false)}
        titre={t("recherche.voyageurs")}
        etiquetteFermer={t("demande.fermer")}
      >
        <div className="space-y-5">
          <Compteur
            libelle={t("recherche.voyageurs")}
            valeur={voyageurs}
            min={1}
            max={16}
            onChange={setVoyageurs}
          />
          <Bouton variante="principal" largeur="pleine" onClick={() => setFeuilleVoyageurs(false)}>
            {t("recherche.rechercher")}
          </Bouton>
        </div>
      </FeuilleBasse>
    </form>
  );
}

function Onglet({
  actif,
  onClick,
  icone,
  libelle,
}: {
  actif: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  libelle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={actif}
      className={
        // Sur téléphone les deux onglets se partagent la largeur. `min-w-0` est
        // indispensable : sans lui un élément flexible refuse de descendre sous la
        // largeur de son texte, et le libellé se fait couper (§C.5).
        "flex min-h-[56px] min-w-0 flex-1 items-center justify-center gap-2 px-2 text-center " +
        "text-[14px] font-semibold leading-tight transition-colors " +
        "md:min-w-[240px] md:flex-initial md:gap-3 md:px-3 md:text-[16px] " +
        (actif ? "bg-nuit text-white" : "bg-fond text-nuit hover:bg-bordure/60")
      }
    >
      {icone}
      {libelle}
    </button>
  );
}

/** Le cadre de la maquette : 70 px, bordure, icône à gauche, libellé au-dessus. */
const CADRE =
  "flex h-[70px] items-center gap-4 rounded-xl border border-bordure px-5 text-left " +
  "transition-colors hover:border-nuit/25 focus-within:border-nuit/40";

function Cadre({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={CADRE}>
      <span className="shrink-0 text-nuit">{icone}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function CadreBouton({
  onClick,
  icone,
  label,
  valeur,
  chevron,
  tabulaire,
  vide,
}: {
  onClick: () => void;
  icone: React.ReactNode;
  label: string;
  valeur: string;
  chevron?: boolean;
  tabulaire?: boolean;
  vide?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`${CADRE} w-full`}>
      <span className="shrink-0 text-nuit">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-gris">{label}</span>
        <span
          className={
            "block truncate text-[17px] font-semibold " +
            (vide ? "text-gris " : "text-nuit ") +
            (tabulaire ? "chiffres-tabulaires" : "")
          }
        >
          {valeur}
        </span>
      </span>
      {chevron && (
        <ChevronDown strokeWidth={2} className="h-[20px] w-[20px] shrink-0 text-nuit" />
      )}
    </button>
  );
}
