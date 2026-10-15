"use client";

import { useState } from "react";
import type { Vehicule } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Champ, Compteur, Icone } from "@teranga/ui";
import { IndicateurEtapes } from "./indicateur-etapes";
import { formaterDateComplete, formaterHeure } from "@/lib/dates";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { formaterPrix } from "@/lib/prix";
import { creerDemandeTransportAction } from "./actions";
import type { EtatEnvoi } from "@/mocks/api";

/**
 * Demande de transport — maquette transport, écran 5.
 *
 * Trois étapes : le trajet, vos informations, la confirmation. La saisie est
 * conservée d'une étape à l'autre, y compris en revenant en arrière (§B.1).
 *
 * Les mêmes règles que pour un logement : rien n'est bloqué, rien n'est payé,
 * et le nom comme le numéro du chauffeur n'arrivent qu'après confirmation
 * (§D.4) — ils ne sont donc affichés nulle part sur cet écran.
 */
export function FormulaireTransport({
  vehicule,
  prestation,
  depart,
  arrivee,
  quand,
  passagers,
  etatSimule = "normal",
}: {
  vehicule: Vehicule;
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee: string;
  quand: string;
  passagers: number;
  etatSimule?: EtatEnvoi;
}) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();

  const [etape, setEtape] = useState(1);
  const [lieuDepart, setLieuDepart] = useState(depart);
  const [lieuArrivee, setLieuArrivee] = useState(arrivee);
  const [moment, setMoment] = useState(quand);
  const [voyageurs, setVoyageurs] = useState(passagers);
  const [bagages, setBagages] = useState(1);
  const [vol, setVol] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [message, setMessage] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, boolean>>({});
  const [envoi, setEnvoi] = useState<"repos" | "encours" | "fait">("repos");
  const [reference, setReference] = useState("");

  const prix =
    prestation === "journee"
      ? (vehicule.prixParJour ?? vehicule.prixParTrajet ?? 0)
      : (vehicule.prixParTrajet ?? vehicule.prixParJour ?? 0);

  const etapes = [t("demandeTransport.etape1"), t("demandeTransport.etape2"), t("demandeTransport.etape3")];

  function valider1() {
    const manques = { depart: lieuDepart.trim().length < 2 };
    setErreurs(manques);
    if (!manques.depart) setEtape(2);
  }

  async function envoyer() {
    const manques = {
      nom: nom.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      telephone: telephone.replace(/\D/g, "").length < 6,
    };
    setErreurs(manques);
    if (Object.values(manques).some(Boolean)) return;

    setEnvoi("encours");
    const resultat = await creerDemandeTransportAction(
      {
        vehiculeId: vehicule.id,
        prestation,
        depart: lieuDepart.trim(),
        arrivee: lieuArrivee.trim() || undefined,
        quand: moment,
        passagers: voyageurs,
        bagages,
        vol: vol.trim() || undefined,
        message: message.trim() || undefined,
      },
      etatSimule,
      { email, telephone },
    );

    if (resultat.succes) {
      setReference(resultat.demande.reference);
      setEnvoi("fait");
      setEtape(3);
    } else {
      setEnvoi("repos");
    }
  }

  return (
    <div className="space-y-7">
      <IndicateurEtapes
        etapes={etapes}
        courante={etape}
        resume={t("demandeTransport.etapeSur", { index: etape })}
      />

      {/* Le véhicule demandé, visible à chaque étape : on sait ce qu'on réserve. */}
      {etape < 3 && (
        <Carte className="flex items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vehicule.photos[0].url}
            alt={vehicule.photos[0].alt}
            className="h-16 w-24 shrink-0 rounded-control object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-titre-3 text-encre">
              {vehicule.marque} {vehicule.modele}
            </p>
            <p className="mt-0.5 text-petit text-encre-douce">
              {t(`categorieVehicule.${vehicule.categorie}`)} · {vehicule.placesPassagers}
            </p>
          </div>
          <p className="shrink-0 text-titre-3 text-encre chiffres-tabulaires">
            {formaterPrix(prix, langue)}
          </p>
        </Carte>
      )}

      {etape === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            valider1();
          }}
          className="space-y-5"
        >
          <Champ
            libelle={t("demandeTransport.priseEnCharge")}
            icone="repere"
            value={lieuDepart}
            onChange={(e) => setLieuDepart(e.target.value)}
            erreur={erreurs.depart ? t("demandeTransport.departRequis") : undefined}
          />
          {prestation !== "journee" && (
            <Champ
              libelle={t("demandeTransport.destination")}
              icone="repere"
              value={lieuArrivee}
              onChange={(e) => setLieuArrivee(e.target.value)}
            />
          )}
          <Champ
            libelle={t("demandeTransport.dateHeure")}
            type="datetime-local"
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
          />

          <Carte className="space-y-3 p-4">
            <Compteur
              libelle={t("demandeTransport.passagers")}
              valeur={voyageurs}
              min={1}
              max={vehicule.placesPassagers}
              onChange={setVoyageurs}
            />
            <Compteur
              libelle={t("demandeTransport.bagages")}
              valeur={bagages}
              min={0}
              max={vehicule.bagages}
              onChange={setBagages}
            />
          </Carte>

          <Champ
            libelle={t("demandeTransport.vol")}
            aide={t("demandeTransport.volAide")}
            icone="avion"
            value={vol}
            onChange={(e) => setVol(e.target.value)}
          />

          <Bouton type="submit" variante="principal" largeur="pleine">
            {t("demandeTransport.continuer")}
          </Bouton>
        </form>
      )}

      {etape === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void envoyer();
          }}
          className="space-y-5"
        >
          <Champ
            libelle={t("demandeTransport.nomComplet")}
            autoComplete="name"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            erreur={erreurs.nom ? t("demandeTransport.nomRequis") : undefined}
          />
          <Champ
            libelle={t("demandeTransport.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erreur={erreurs.email ? t("compte.identifiantErreur") : undefined}
          />
          <Champ
            libelle={t("demandeTransport.telephone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            tabulaire
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            erreur={erreurs.telephone ? t("demande.telephoneRequis") : undefined}
          />

          <label className="block">
            <span className="mb-1.5 block text-petit text-encre">
              {t("demandeTransport.message")}
            </span>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("demandeTransport.messagePlaceholder")}
              className="w-full rounded-control border border-contour-champ bg-surface px-4 py-3 text-petit text-encre outline-none placeholder:text-encre-douce focus-visible:border-primaire"
            />
          </label>

          <Carte>
            <dl className="divide-y divide-contour">
              <Ligne terme={t("demandeTransport.recapTrajet")}>
                {lieuDepart}
                {lieuArrivee ? ` → ${lieuArrivee}` : ""}
              </Ligne>
              <Ligne terme={t("demandeTransport.recapQuand")}>
                {`${formaterDateComplete(new Date(moment), langue)} · ${formaterHeure(new Date(moment), langue)}`}
              </Ligne>
              <Ligne terme={t("demandeTransport.recapVoyageurs")}>
                <span className="chiffres-tabulaires">{voyageurs}</span>
              </Ligne>
              <Ligne terme={t("demandeTransport.recapTotal")}>
                <span className="chiffres-tabulaires font-semibold">
                  {formaterPrix(prix, langue)}
                </span>
              </Ligne>
            </dl>
          </Carte>

          <Bandeau variante="information">{t("demandeTransport.aucunPaiement")}</Bandeau>
          <Bandeau variante="information">{t("demandeTransport.coordonneesApres")}</Bandeau>

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Bouton
              type="submit"
              variante="principal"
              largeur="pleine"
              enCours={envoi === "encours"}
            >
              {t("demandeTransport.envoyer")}
            </Bouton>
            <Bouton variante="secondaire" largeur="pleine" onClick={() => setEtape(1)}>
              {t("demandeTransport.precedent")}
            </Bouton>
          </div>
        </form>
      )}

      {etape === 3 && (
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-pill bg-teinte-vert text-succes">
            <Icone nom="coche-cercle" taille={32} />
          </span>
          <h2 className="mt-5 text-titre-1 text-encre">
            {t("demandeTransport.envoyeeTitre")}
          </h2>
          <p className="mt-2 text-petit text-encre-douce chiffres-tabulaires">{reference}</p>
          <p className="mx-auto mt-3 max-w-[46ch] text-corps text-encre-douce">
            {t("demandeTransport.envoyeeTexte")}
          </p>

          <div className="mx-auto mt-5 max-w-[460px] text-left">
            <Bandeau variante="information">{t("demandeTransport.delaiReponse")}</Bandeau>
          </div>

          <div className="mx-auto mt-7 max-w-[320px] space-y-3">
            <Bouton
              variante="principal"
              largeur="pleine"
              onClick={() => naviguer("/mes-demandes")}
            >
              {t("demandeTransport.voirMesDemandes")}
            </Bouton>
            <Bouton variante="secondaire" largeur="pleine" onClick={() => naviguer("/")}>
              {t("demandeTransport.retourAccueil")}
            </Bouton>
          </div>
        </div>
      )}
    </div>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre">{children}</dd>
    </div>
  );
}
