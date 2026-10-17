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
import { TYPES_LOGEMENT, type TypeLogement } from "@teranga/contracts";
import { SelecteurDates, type Plage } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { etiquettesDates } from "@/features/transport/etiquettes-dates";
import { formaterDateComplete } from "@/lib/dates";
import { FENETRE_JEUX, SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import { LIEUX, TAILLES_PASSAGERS } from "@/mocks/fixtures/vehicules";
import { TAILLES_SEJOUR, VILLES } from "@/mocks/fixtures/logements";
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
  /**
   * Sur l'accueil, l'onglet logement demande un **type**, pas une ville : un
   * visiteur qui arrive aux Jeux connaît « villa » ou « studio », il ne connaît
   * ni Ngaparou ni Guéréo. La ville se choisit ensuite, sur l'écran de
   * résultats, où elle est accompagnée du nombre d'offres.
   *
   * L'onglet transport garde le champ de lieu : l'aéroport et les sites des
   * Jeux, eux, sont les seuls noms qu'un visiteur connaisse d'avance.
   */
  const [type, setType] = useState<TypeLogement | "">("");
  const [destination, setDestination] = useState("");
  const [plage, setPlage] = useState<Plage>({ ...SEJOUR_DEFAUT });
  /**
   * Une taille de séjour, pas un nombre.
   *
   * Le compteur demandait au visiteur de traduire son voyage en chiffre avant
   * même d'avoir vu une offre. Il annonce maintenant ce qu'il est — seul, à
   * deux, en famille — et chaque intitulé porte le nombre d'offres qui
   * l'accueillent, pour qu'aucun choix ne mène à une page vide.
   */
  const [voyageurs, setVoyageurs] = useState(2);

  const etiquettes = etiquettesDates(t, langue);
  const lieux = onglet === "logements" ? VILLES : LIEUX;
  /** Le premier cadre demande un lieu — sauf sur l'accueil, onglet logement. */
  const champLieu = sansOnglets || onglet === "transports";
  /**
   * La destination du formulaire suit l'onglet.
   *
   * Elle ne le suivait pas : l'`action` pointait toujours sur les logements, et
   * une recherche de transport lancée **avant l'hydratation** — un téléphone en
   * 3G, le temps que le JavaScript arrive — atterrissait dans la liste des
   * logements. Le `passagers` manquait pour la même raison.
   */
  const destinationFormulaire = champLieu && !sansOnglets ? "/transports/location" : "/logements";
  /**
   * Le champ « qui voyage » n'a pas la même unité des deux côtés.
   *
   * Un logement s'adresse à un séjour — seul, à deux, en famille. Un véhicule
   * compte des passagers, parce que ce sont des places assises : « une famille »
   * ne dit pas si l'on tient dans une berline. Les deux listes sortent du
   * catalogue, et aucune des deux ne propose ce qui n'existe pas.
   */
  const chercheUnVehicule = destinationFormulaire !== "/logements";
  const tailles = chercheUnVehicule
    ? TAILLES_PASSAGERS.map((taille) => ({
        valeur: taille.passagers,
        intitule: t("transport.passagersNombre", { nombre: taille.passagers }),
        offres: taille.vehicules,
      }))
    : TAILLES_SEJOUR.map((taille) => ({
        valeur: taille.personnes,
        intitule: t(`recherche.tailles.${taille.cle}`),
        offres: taille.offres,
      }));
  /**
   * La taille affichée, quand celle qu'on avait n'existe pas dans l'autre liste.
   *
   * On retombe sur la plus grande qui tienne, jamais sur la première : un
   * groupe de huit qui passe à l'onglet transport devient six passagers — le
   * plus grand véhicule du parc — et non un seul.
   */
  const choisie =
    tailles.find((taille) => taille.valeur === voyageurs) ??
    [...tailles].reverse().find((taille) => taille.valeur <= voyageurs) ??
    tailles[0];
  const decompte = chercheUnVehicule
    ? t("transport.vehiculesCompte", { nombre: choisie.offres })
    : t("recherche.taillesOffres", { nombre: choisie.offres });

  function rechercher() {
    // `choisie` plutôt que `voyageurs` : en passant d'un onglet à l'autre, une
    // taille peut ne plus exister — huit personnes, mais aucun véhicule de huit
    // places. C'est la valeur réellement affichée qui part, jamais une autre.
    const params = new URLSearchParams({ personnes: String(choisie.valeur) });
    // Écran 01 et onglet transport cherchent un lieu ; l'accueil, un type.
    if (champLieu) {
      if (destination.trim()) params.set("ville", destination.trim());
    } else if (type) {
      params.set("types", type);
    }
    if (plage.debut) params.set("debut", plage.debut);
    if (plage.fin) params.set("fin", plage.fin);

    // Le transport n'a qu'un besoin qui prend ville, période et passagers :
    // la location avec chauffeur. Les deux autres demandent un trajet précis,
    // que cette barre ne saisit pas — le visiteur les choisit sur /transports.
    if (onglet === "transports") {
      params.set("passagers", String(choisie.valeur));
      naviguer(`/transports/location?${params.toString()}`);
      return;
    }
    naviguer(`/logements?${params.toString()}`);
  }

  return (
    <form
      action={`/${langue}${destinationFormulaire}`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        rechercher();
      }}
      className="rounded-[20px] bg-white p-3.5 sm:p-[18px] shadow-carte"
    >
      {/* Portés par le formulaire lui-même, pour la soumission sans JavaScript. */}
      <input type="hidden" name="debut" value={plage.debut ?? ""} />
      <input type="hidden" name="fin" value={plage.fin ?? ""} />
      {/* Le sélecteur plus bas porte `personnes` côté logement et `passagers`
          côté transport ; l'autre nom suit en champ caché, pour que l'URL ait
          la même forme avec ou sans JavaScript. */}
      {chercheUnVehicule && <input type="hidden" name="personnes" value={choisie.valeur} />}
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
      <div
        className={
          (sansOnglets ? "" : "mt-4 sm:mt-5 ") +
          "grid gap-3 sm:gap-[17px] " +
          (sansOnglets
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
            : "grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]")
        }
      >
        {/* Destination : un vrai champ, avec la liste des lieux connus puis
            saisie libre — le `<datalist>` du navigateur, comme SelecteurLieu. */}
        {!champLieu && (
          <Cadre icone={<House strokeWidth={1.6} className="h-[24px] w-[24px]" />}>
            <label htmlFor={`${idListe}-type`} className="block text-[13px] text-gris">
              {t("recherche.typeLogement")}
            </label>
            {/* Un `select` natif : il s'ouvre sans JavaScript, et sur téléphone
                c'est la roue du système qui s'affiche plutôt qu'un menu refait. */}
            <select
              id={`${idListe}-type`}
              name="types"
              value={type}
              onChange={(e) => setType(e.target.value as TypeLogement | "")}
              className="block w-full truncate bg-transparent text-[16px] sm:text-[17px] font-semibold text-nuit outline-none"
            >
              <option value="">{t("recherche.tousTypes")}</option>
              {TYPES_LOGEMENT.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {t(`typeLogement.${valeur}`)}
                </option>
              ))}
            </select>
          </Cadre>
        )}

        {champLieu && (
        <div className={sansOnglets ? "md:col-span-2 xl:col-span-1" : ""}>
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
              className="block w-full truncate bg-transparent text-[16px] sm:text-[17px] font-semibold text-nuit outline-none placeholder:font-normal placeholder:text-gris"
            />
            <datalist id={idListe}>
              {lieux.map((lieu) => (
                <option key={lieu.valeur} value={lieu.valeur}>
                  {lieu.detail}
                </option>
              ))}
            </datalist>
          </Cadre>
        </div>
        )}

        {/* Dates : le calendrier du design system, déclenché par le champ de la maquette. */}
        <SelecteurDates
          libelle={t("recherche.dates")}
          plage={plage}
          onChange={setPlage}
          etiquettes={etiquettes}
          minimum={FENETRE_JEUX.debut}
          // Deux bornes partout, accueil comprise : un champ « Dates » unique
          // cachait qu'il en faut deux, et le résumé « 17 – 24 oct. » demandait
          // d'ouvrir le calendrier pour savoir laquelle manquait. Les deux
          // boîtes ouvrent le même calendrier, mais chacune **sur sa borne** :
          // on clique « Arrivée », on choisit un jour, on valide. Demander deux
          // clics d'affilée dans la même feuille obligeait à deviner que le
          // second servait au départ.
          rendreChamp={({ ouvrir }) => (
            <>
              <CadreBouton
                onClick={() => ouvrir("debut")}
                icone={<CalendarDays strokeWidth={1.6} className="h-[24px] w-[24px]" />}
                label={t("fiche.debut")}
                valeur={plage.debut ? formaterDateComplete(new Date(`${plage.debut}T00:00:00`), langue) : "—"}
                vide={!plage.debut}
                tabulaire
              />
              <CadreBouton
                onClick={() => ouvrir("fin")}
                icone={<CalendarDays strokeWidth={1.6} className="h-[24px] w-[24px]" />}
                label={t("fiche.fin")}
                valeur={plage.fin ? formaterDateComplete(new Date(`${plage.fin}T00:00:00`), langue) : "—"}
                vide={!plage.fin}
                tabulaire
              />
            </>
          )}
        />

        {/* Voyageurs : une taille de séjour, avec le nombre d'offres. */}
        <Cadre icone={<User strokeWidth={1.6} className="h-[24px] w-[24px]" />}>
          {/* Le décompte vit sur la ligne du libellé, pas dans l'option : collé
              à l'intitulé il dépassait la largeur du champ et se faisait couper
              (« Un couple (24 logeme… »). Il ne vaut que pour les logements —
              un véhicule ne se compte pas en nuitées. */}
          <label htmlFor={`${idListe}-voyageurs`} className="block truncate text-[13px] text-gris">
            {chercheUnVehicule ? t("transport.passagers") : t("recherche.voyageurs")}
            {` · ${decompte}`}
          </label>
          <select
            id={`${idListe}-voyageurs`}
            name={chercheUnVehicule ? "passagers" : "personnes"}
            value={choisie.valeur}
            onChange={(e) => setVoyageurs(Number(e.target.value))}
            className="block w-full truncate bg-transparent text-[17px] font-semibold text-nuit outline-none"
          >
            {tailles.map((taille) => (
              <option key={taille.valeur} value={taille.valeur}>
                {taille.intitule}
              </option>
            ))}
          </select>
        </Cadre>

        <button
          type="submit"
          className={
            "flex h-[58px] sm:h-[70px] w-full items-center justify-center gap-3 rounded-xl bg-jaune " +
            "px-6 sm:px-10 text-[16px] sm:text-[17px] font-semibold text-nuit transition-colors hover:bg-jaune-vif " +
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuit min-w-0 " +
            (sansOnglets ? "xl:w-auto xl:min-w-[200px]" : "lg:w-auto lg:min-w-[200px]")
          }
        >
          <Search strokeWidth={2.2} className="h-[21px] w-[21px]" />
          {t("recherche.rechercher")}
        </button>
      </div>

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

/** Le cadre de la maquette : 58 px sur mobile, 70 px sur écran plus large, bordure, icône à gauche, libellé au-dessus. */
const CADRE =
  "flex h-[58px] sm:h-[70px] items-center gap-3 sm:gap-4 rounded-xl border border-bordure px-3.5 sm:px-5 text-left " +
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
