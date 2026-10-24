"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Vehicule } from "@teranga/contracts";
import { Bandeau, Carte, Champ, Compteur, Icone } from "@teranga/ui";
import { IndicateurEtapes } from "./indicateur-etapes";
import { formaterDateComplete, formaterHeure } from "@/lib/dates";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { formaterPrixVisiteur } from "@/lib/prix";
import { creerDemandeTransportAction } from "./actions";
import { nomLisible } from "@/features/compte/cookie";
import { type EtatEnvoi } from "@/mocks/api";
import { mettreDemandeDeCoteEtSInscrire, oublierBrouillonAction } from "./actions";
import type { BrouillonTransport } from "./brouillon";

/**
 * Demande de transport — maquette transport, écran 5.
 *
 * Trois étapes : le trajet, vos informations, la confirmation. La saisie est
 * conservée d'une étape à l'autre, y compris en revenant en arrière (§B.1).
 *
 * Mêmes règles que pour un logement : rien n'est bloqué, rien n'est payé à l'envoi,
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
  visiteur,
  brouillon,
}: {
  vehicule: Vehicule;
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee: string;
  quand: string;
  passagers: number;
  etatSimule?: EtatEnvoi;
  visiteur?: { email: string; telephone?: string | null; identifiant: string };
  /** Saisie mise de côté avant de créer un compte, à retrouver au retour. */
  brouillon?: BrouillonTransport | null;
}) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();

  // Au retour d'une inscription, la saisie est rétablie et on repart au
  // récapitulatif. La session a priorité sur le brouillon pour le contact :
  // elle vient de l'API, lui du navigateur.
  const [etape, setEtape] = useState(brouillon ? 2 : 1);
  const [lieuDepart, setLieuDepart] = useState(brouillon?.depart ?? depart);
  const [lieuArrivee, setLieuArrivee] = useState(brouillon?.arrivee ?? arrivee);
  const [moment, setMoment] = useState(brouillon?.quand ?? quand);
  const [voyageurs, setVoyageurs] = useState(brouillon?.passagers ?? passagers);
  const [bagages, setBagages] = useState(brouillon?.bagages ?? 1);
  const [vol, setVol] = useState(brouillon?.vol ?? "");
  const [nom, setNom] = useState(
    visiteur ? nomLisible(visiteur.identifiant) : (brouillon?.nom ?? ""),
  );
  const [email, setEmail] = useState(visiteur?.email ?? brouillon?.email ?? "");
  const [telephone, setTelephone] = useState(visiteur?.telephone ?? brouillon?.telephone ?? "");
  const [message, setMessage] = useState(brouillon?.message ?? "");
  const [erreurs, setErreurs] = useState<Record<string, boolean>>({});
  const [envoi, setEnvoi] = useState<"repos" | "encours" | "fait">("repos");
  const [reference, setReference] = useState("");
  const [emailEnvoye, setEmailEnvoye] = useState(false);

  /** Message d'échec de l'envoi : une demande refusée doit se voir. */
  const [echec, setEchec] = useState<string | null>(null);

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
    setEchec(null);
    try {
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
        { email, nom, telephone },
      );

      if (resultat.succes) {
        await oublierBrouillonAction().catch(() => {});
        setReference(resultat.demande.reference);
        setEmailEnvoye(resultat.demande.emailEnvoye);
        setEnvoi("fait");
        setEtape(3);
      } else {
        setEnvoi("repos");
        // Comme pour le logement : aucune issue ne se termine en silence.
        switch (resultat.erreur) {
          case "delai_trop_court":
            setEtape(1);
            setEchec(resultat.message ?? t("demandeTransport.delaiTropCourt"));
            break;
          case "validation":
            setEtape(1);
            setEchec(resultat.message ?? t("demande.echecTexte"));
            break;
          default:
            setEchec(resultat.message ?? t("demande.echecTexte"));
        }
      }
    } catch {
      setEnvoi("repos");
      setEchec(t("demande.echecTexte"));
    }
  }

  return (
    <div className="space-y-4">
      <IndicateurEtapes
        etapes={etapes}
        courante={etape}
        resume={t("demandeTransport.etapeSur", { index: etape })}
      />

      {echec && (
        <Bandeau
          variante="erreur"
          action={
            <button
              type="button"
              onClick={() => setEchec(null)}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              {t("demande.fermer")}
            </button>
          }
        >
          <strong className="block font-semibold">{t("demande.echecTitre")}</strong>
          {echec}
        </Bandeau>
      )}

      {etape === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            valider1();
          }}
          className="space-y-3.5"
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

          <button
            type="submit"
            className={
              "group relative flex h-[50px] w-full items-center justify-center gap-2.5 rounded-pill " +
              "border border-transparent bg-primaire text-[16px] font-semibold text-white " +
              "shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all duration-200 " +
              "hover:border-jaune-vif hover:bg-[#072c4e] hover:shadow-[0_6px_24px_-4px_rgba(244,185,66,0.35)] " +
              "hover:ring-2 hover:ring-jaune-vif/50 focus-visible:outline-2 focus-visible:outline-offset-2 " +
              "focus-visible:outline-primaire active:scale-[0.99]"
            }
          >
            <span>{t("demandeTransport.continuer")}</span>
            <ArrowRight
              strokeWidth={2.2}
              className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
            />
          </button>
        </form>
      )}

      {etape === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void envoyer();
          }}
          className="space-y-3.5"
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
            <span className="mb-1 block text-petit text-encre">
              {t("demandeTransport.message")}
            </span>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("demandeTransport.messagePlaceholder")}
              className="w-full rounded-control border border-contour-champ bg-surface px-4 py-2.5 text-petit text-encre outline-none placeholder:text-encre-douce focus-visible:border-primaire"
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
                  {formaterPrixVisiteur(prix, langue)}
                </span>
              </Ligne>
            </dl>
          </Carte>

          <Bandeau variante="information">{t("demandeTransport.aucunPaiement")}</Bandeau>
          <Bandeau variante="information">{t("demandeTransport.coordonneesApres")}</Bandeau>

          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={envoi === "encours"}
              className={
                "group relative flex h-[48px] sm:h-[50px] flex-1 items-center justify-center gap-2.5 rounded-pill " +
                "border border-transparent bg-primaire text-[15.5px] sm:text-[16px] font-semibold text-white " +
                "shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all duration-200 " +
                "hover:border-jaune-vif hover:bg-[#072c4e] hover:shadow-[0_6px_24px_-4px_rgba(244,185,66,0.35)] " +
                "hover:ring-2 hover:ring-jaune-vif/50 focus-visible:outline-2 focus-visible:outline-offset-2 " +
                "focus-visible:outline-primaire active:scale-[0.99] disabled:opacity-45"
              }
            >
              <span>{envoi === "encours" ? t("demande.envoiEnCours") : t("demandeTransport.envoyer")}</span>
              <ArrowRight
                strokeWidth={2.2}
                className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
              />
            </button>
            <button
              type="button"
              onClick={() => setEtape(1)}
              className="flex h-[48px] sm:h-[50px] items-center justify-center rounded-pill border border-contour bg-surface px-5 text-[14.5px] font-semibold text-encre transition-colors hover:bg-champ focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
            >
              {t("demandeTransport.precedent")}
            </button>
          </div>

          {/* Même sortie que côté logement : un vrai compte, sans perdre la saisie. */}
          {!visiteur && (
            <p className="text-center text-petit text-encre-douce">
              {t("demande.plutotUnCompte")}{" "}
              <button
                type="button"
                className="font-semibold text-primaire underline underline-offset-2"
                onClick={() =>
                  void mettreDemandeDeCoteEtSInscrire(
                    {
                      genre: "vehicule",
                      vehiculeId: vehicule.id,
                      prestation,
                      depart: lieuDepart,
                      arrivee: lieuArrivee || undefined,
                      quand: moment,
                      passagers: voyageurs,
                      bagages,
                      vol: vol || undefined,
                      nom,
                      email,
                      telephone,
                      message,
                    },
                    `/demande/${vehicule.id}?prestation=${prestation}&quand=${encodeURIComponent(moment)}&passagers=${voyageurs}`,
                    langue,
                  )
                }
              >
                {t("demande.creerUnCompte")}
              </button>
            </p>
          )}
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
          <p role="status" className="mx-auto mt-2 max-w-[46ch] text-petit text-encre-douce">
            {emailEnvoye ? t("confirmation.lienEnvoye") : t("confirmation.lienNonEnvoye")}
          </p>

          <div className="mx-auto mt-5 max-w-[460px] text-left">
            <Bandeau variante="information">{t("demandeTransport.delaiReponse")}</Bandeau>
          </div>

          <div className="mx-auto mt-7 max-w-[320px] space-y-3">
            <button
              type="button"
              onClick={() => naviguer("/mes-demandes")}
              className={
                "group relative flex h-[50px] w-full items-center justify-center gap-2.5 rounded-pill " +
                "border border-transparent bg-primaire text-[16px] font-semibold text-white " +
                "shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all duration-200 " +
                "hover:border-jaune-vif hover:bg-[#072c4e] hover:shadow-[0_6px_24px_-4px_rgba(244,185,66,0.35)] " +
                "hover:ring-2 hover:ring-jaune-vif/50 focus-visible:outline-2 focus-visible:outline-offset-2 " +
                "focus-visible:outline-primaire active:scale-[0.99]"
              }
            >
              <span>{t("demandeTransport.voirMesDemandes")}</span>
              <ArrowRight strokeWidth={2.2} className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => naviguer("/")}
              className="flex h-[46px] w-full items-center justify-center rounded-pill border border-contour bg-surface text-[14.5px] font-semibold text-encre transition-colors hover:bg-champ"
            >
              {t("demandeTransport.retourAccueil")}
            </button>
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
