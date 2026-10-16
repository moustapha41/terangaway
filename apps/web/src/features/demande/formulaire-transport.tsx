"use client";

import { useEffect, useRef, useState } from "react";
import type { Vehicule } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Champ, ChampCode, Compteur, FeuilleBasse, Icone } from "@teranga/ui";
import { IndicateurEtapes } from "./indicateur-etapes";
import { formaterDateComplete, formaterHeure } from "@/lib/dates";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { formaterPrix } from "@/lib/prix";
import { creerDemandeTransportAction } from "./actions";
import { demanderCodeOtpAction } from "@/features/compte/actions";
import { nomLisible } from "@/features/compte/cookie";
import { CODE_DE_DEMONSTRATION, type EtatEnvoi } from "@/mocks/api";
import { apiMockActive } from "@/lib/api/http";
import { mettreDemandeDeCoteEtSInscrire, oublierBrouillonAction } from "./actions";
import type { BrouillonTransport } from "./brouillon";

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

  const [code, setCode] = useState("");
  const [feuilleCode, setFeuilleCode] = useState(false);
  const [erreurCode, setErreurCode] = useState<"faux" | "expire" | null>(null);
  /** Message d'échec de l'envoi : une demande refusée doit se voir. */
  const [echec, setEchec] = useState<string | null>(null);
  /** Le code a-t-il réellement été envoyé ? */
  const [etatCode, setEtatCode] = useState<"inconnu" | "envoye" | "echec">("inconnu");
  const [compteARebours, setCompteARebours] = useState(30);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!feuilleCode) return;
    setCompteARebours(30);
    minuterie.current = setInterval(
      () => setCompteARebours((reste) => (reste <= 1 ? 0 : reste - 1)),
      1000,
    );
    return () => {
      if (minuterie.current) clearInterval(minuterie.current);
    };
  }, [feuilleCode]);

  /** L'indice « le code est 123456 » n'a de sens que si le mock répond. */
  const indiceDemo = apiMockActive()
    ? t("demande.codeDemo", { code: CODE_DE_DEMONSTRATION })
    : etatCode === "envoye"
      ? t("demande.codeEnvoye")
      : undefined;

  /** Demande un code et lit le résultat de l'envoi, au lieu de l'ignorer. */
  async function demanderCode() {
    setErreurCode(null);
    if (!email) {
      setEtatCode("echec");
      return;
    }
    try {
      const resultat = await demanderCodeOtpAction(email);
      setEtatCode(resultat.succes ? "envoye" : "echec");
      if (!resultat.succes) setEchec(resultat.erreur);
    } catch {
      setEtatCode("echec");
    }
  }

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

  async function envoyer(avecCode?: string) {
    const manques = {
      nom: nom.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      telephone: telephone.replace(/\D/g, "").length < 6,
    };
    setErreurs(manques);
    if (Object.values(manques).some(Boolean)) return;

    if (!visiteur && !avecCode) {
      setEtatCode("inconnu");
      setFeuilleCode(true);
      void demanderCode();
      return;
    }

    setEnvoi("encours");
    setErreurCode(null);
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
          code: avecCode,
        },
        etatSimule,
        { email, telephone },
      );

      if (resultat.succes) {
        await oublierBrouillonAction().catch(() => {});
        setFeuilleCode(false);
        setReference(resultat.demande.reference);
        setEnvoi("fait");
        setEtape(3);
      } else {
        setEnvoi("repos");
        // Comme pour le logement : aucune issue ne se termine en silence.
        switch (resultat.erreur) {
          case "code_invalide":
            setErreurCode(resultat.raison ?? "faux");
            setCode("");
            break;
          case "trop_de_tentatives":
            setFeuilleCode(false);
            setEchec(resultat.message ?? t("demande.echecTentatives"));
            break;
          case "session":
            setFeuilleCode(false);
            setEchec(resultat.message ?? t("demande.echecSession"));
            break;
          case "delai_trop_court":
            setFeuilleCode(false);
            setEtape(1);
            setEchec(resultat.message ?? t("demandeTransport.delaiTropCourt"));
            break;
          case "validation":
            setFeuilleCode(false);
            setEtape(1);
            setEchec(resultat.message ?? t("demande.echecTexte"));
            break;
          default:
            setFeuilleCode(false);
            setEchec(resultat.message ?? t("demande.echecTexte"));
        }
      }
    } catch {
      setEnvoi("repos");
      setFeuilleCode(false);
      setEchec(t("demande.echecTexte"));
    }
  }

  return (
    <div className="space-y-7">
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

      <FeuilleBasse
        ouverte={feuilleCode}
        onFermer={() => setFeuilleCode(false)}
        titre="Code de vérification"
        etiquetteFermer={t("demande.fermer")}
      >
        <div className="space-y-5">
          <p className="text-corps text-encre-douce">
            {email
              ? `Un code de vérification à six chiffres a été envoyé à l'adresse e-mail ${email}. Saisissez-le pour confirmer votre demande.`
              : t("demande.codeTexte")}
          </p>

          <ChampCode
            libelle={t("demande.codeLibelle")}
            valeur={code}
            onChange={setCode}
            etat={
              envoi === "encours"
                ? "verification"
                : erreurCode === "expire"
                  ? "expire"
                  : erreurCode
                    ? "erreur"
                    : "vide"
            }
            message={
              erreurCode === "expire"
                ? t("demande.codeExpire")
                : erreurCode === "faux"
                  ? t("demande.codeFaux")
                  : etatCode === "echec"
                    ? t("demande.codeNonEnvoye")
                    : indiceDemo
            }
          />

          <Bouton
            variante="principal"
            largeur="pleine"
            enCours={envoi === "encours"}
            disabled={code.length < 6}
            onClick={() => void envoyer(code)}
          >
            {t("demandeTransport.envoyer")}
          </Bouton>

          <Bouton
            variante="secondaire"
            largeur="pleine"
            disabled={compteARebours > 0}
            onClick={() => {
              setCompteARebours(30);
              void demanderCode();
            }}
          >
            {compteARebours > 0
              ? t("demande.codeRenvoyerDans", { secondes: compteARebours })
              : t("demande.codeRenvoyer")}
          </Bouton>

          {/* Même sortie que côté logement : un vrai compte, sans perdre la saisie. */}
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
        </div>
      </FeuilleBasse>
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
