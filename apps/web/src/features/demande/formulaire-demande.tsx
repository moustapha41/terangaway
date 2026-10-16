"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Logement } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Champ, ChampCode, Compteur, FeuilleBasse, Icone } from "@teranga/ui";
import { IndicateurEtapes } from "./indicateur-etapes";
import { Lien } from "@/lib/i18n/lien";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { useEnLigne } from "@/lib/hors-ligne/etat-reseau";
import { formaterDateComplete, nombreDeNuits } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { PrixConverti } from "@/features/preferences/prix-converti";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { creerDemandeLogementAction } from "@/features/demande/actions";
import { demanderCodeOtpAction } from "@/features/compte/actions";
import { nomLisible } from "@/features/compte/cookie";
import { CODE_DE_DEMONSTRATION, type EtatEnvoi } from "@/mocks/api";
import { apiMockActive } from "@/lib/api/http";
import { mettreDemandeDeCoteEtSInscrire, oublierBrouillonAction } from "./actions";
import type { BrouillonLogement } from "./brouillon";

/**
 * Écrans 4, 9 et 10 · Demande en trois étapes.
 *
 * 1. Informations — qui vous êtes, combien vous êtes, un message.
 * 2. Récapitulatif — l'offre, les dates, le détail du prix.
 * 3. Confirmation — page séparée, après l'envoi.
 *
 * La maquette ne montre pas le code à six chiffres ; le dossier l'exige à
 * l'envoi quand le visiteur n'est pas connecté (§B.2, étape 4). Il apparaît donc
 * en feuille basse au-dessus de l'étape 2, ce qui respecte les deux : trois
 * étapes visibles, et aucune demande envoyée sans numéro vérifié.
 *
 * Rien n'est perdu entre les étapes : revenir en arrière garde toute la saisie.
 */
/**
 * Indicatifs courants pour les visiteurs des Jeux.
 *
 * Le drapeau est un emoji, pas une image : il suit la police du système, pèse
 * deux octets et reste net partout. Le nom du pays va dans l'attribut `title` —
 * un `<select>` n'affiche que le libellé choisi, et « +221 · Sénégal » déborde
 * sur un écran de téléphone.
 */
const INDICATIFS = [
  { code: "+221", pays: "Sénégal", drapeau: "🇸🇳" },
  { code: "+33", pays: "France", drapeau: "🇫🇷" },
  { code: "+34", pays: "España", drapeau: "🇪🇸" },
  { code: "+44", pays: "United Kingdom", drapeau: "🇬🇧" },
  { code: "+1", pays: "USA / Canada", drapeau: "🇺🇸" },
];

const SECONDES_AVANT_RENVOI = 30;

export function FormulaireDemande({
  logement,
  debut,
  fin,
  personnes,
  etatSimule,
  visiteur,
  brouillon,
}: {
  logement: Logement;
  debut: string;
  fin: string;
  personnes: number;
  etatSimule: EtatEnvoi;
  visiteur?: { email: string; telephone?: string | null; identifiant: string };
  /** Saisie mise de côté avant de créer un compte, à retrouver au retour. */
  brouillon?: BrouillonLogement | null;
}) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();
  const enLigne = useEnLigne();

  // Au retour d'une inscription, on reprend là où la saisie s'était arrêtée :
  // directement au récapitulatif, avec les informations déjà données. La
  // session a priorité sur le brouillon pour le contact — elle vient de l'API,
  // lui du navigateur.
  const [etape, setEtape] = useState<1 | 2>(brouillon ? 2 : 1);
  const [nom, setNom] = useState(
    visiteur ? nomLisible(visiteur.identifiant) : (brouillon?.nom ?? ""),
  );
  const [email, setEmail] = useState(visiteur?.email ?? brouillon?.email ?? "");
  const [indicatif, setIndicatif] = useState("+221");
  const [telephone, setTelephone] = useState(visiteur?.telephone ?? brouillon?.telephone ?? "");
  const [voyageurs, setVoyageurs] = useState(brouillon?.personnes ?? personnes);
  const [message, setMessage] = useState(brouillon?.message ?? "");

  const [code, setCode] = useState("");
  const [feuilleCode, setFeuilleCode] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurCode, setErreurCode] = useState<"faux" | "expire" | null>(null);
  /**
   * Message d'échec de l'envoi, affiché tel quel.
   *
   * Sans lui, une demande refusée par l'API arrêtait simplement le bouton de
   * tourner : aucun message, aucune explication, et le visiteur n'avait aucun
   * moyen de savoir que rien n'était parti.
   */
  const [echec, setEchec] = useState<string | null>(null);
  /** Le code a-t-il réellement été envoyé ? Le silence n'est pas une réponse. */
  const [etatCode, setEtatCode] = useState<"inconnu" | "envoye" | "echec">("inconnu");
  const [erreurs, setErreurs] = useState<Record<string, boolean>>({});
  const [pris, setPris] = useState<Logement[] | null>(null);
  const [compteARebours, setCompteARebours] = useState(SECONDES_AVANT_RENVOI);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!feuilleCode) return;
    setCompteARebours(SECONDES_AVANT_RENVOI);
    minuterie.current = setInterval(
      () => setCompteARebours((reste) => (reste <= 1 ? 0 : reste - 1)),
      1000,
    );
    return () => {
      if (minuterie.current) clearInterval(minuterie.current);
    };
  }, [feuilleCode]);

  /**
   * L'indice « le code est 123456 », et seulement là où il est vrai.
   *
   * `apiMockActive()` lit `NEXT_PUBLIC_API_MOCK`, figé à la construction : la
   * valeur est donc la même côté serveur et côté navigateur, sans aller-retour.
   */
  const indiceDemo = apiMockActive()
    ? t("demande.codeDemo", { code: CODE_DE_DEMONSTRATION })
    : etatCode === "envoye"
      ? t("demande.codeEnvoye")
      : undefined;

  /**
   * Demande un code et **regarde si l'envoi a réussi**.
   *
   * L'appel était auparavant `demanderCodeOtpAction(email).catch(() => {})` :
   * si Resend tombait, ou si l'adresse était limitée en débit, la feuille
   * s'ouvrait exactement comme si un code était parti.
   */
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

  const nuits = nombreDeNuits(new Date(`${debut}T00:00:00`), new Date(`${fin}T00:00:00`)) || 1;
  const fraisFixes = logement.fraisFixes ?? [];
  const sousTotal = logement.prixParNuit * nuits;
  const total = sousTotal + fraisFixes.reduce((s, f) => s + f.montant, 0);

  const etapes = [
    t("demande.etapeInformations"),
    t("demande.etapeDetails"),
    t("demande.etapeConfirmation"),
  ];

  function valider() {
    const manques = {
      nom: nom.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      telephone: telephone.replace(/\D/g, "").length < 6,
    };
    setErreurs(manques);
    if (Object.values(manques).some(Boolean)) return;
    setEtape(2);
  }

  async function envoyer(avecCode?: string) {
    setEnCours(true);
    setErreurCode(null);
    setEchec(null);
    try {
      const resultat = await creerDemandeLogementAction(
        {
          logementId: logement.id,
          debut,
          fin,
          personnes: voyageurs,
          message,
          code: avecCode,
        },
        etatSimule,
        { email, telephone },
      );

      if (resultat.succes) {
        // La demande est partie : le brouillon n'a plus de raison d'être, et le
        // laisser repréremplirait le formulaire d'une réservation déjà envoyée.
        await oublierBrouillonAction().catch(() => {});
        naviguer(`/demande/confirmation?reference=${resultat.demande.reference}`);
        return;
      }

      // Chaque issue a sa suite. Aucune ne doit se terminer par un écran muet :
      // c'est précisément ce que faisait la version déployée pour « serveur »
      // et « validation », les deux cas les plus fréquents en production.
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
        case "logement_pris":
          setFeuilleCode(false);
          setPris(resultat.alternatives ?? []);
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
    } catch {
      // Action serveur injoignable : le dire, plutôt que d'arrêter le bouton
      // de tourner sans un mot.
      setFeuilleCode(false);
      setEchec(t("demande.echecTexte"));
    } finally {
      setEnCours(false);
    }
  }

  if (pris) return <Alternatives logements={pris} />;

  return (
    <div className="space-y-7">
      <IndicateurEtapes
        etapes={etapes}
        courante={etape}
        resume={t("demande.etapeSur", { index: etape, total: 3 })}
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

      {etape === 1 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            valider();
          }}
          className="space-y-6"
        >
          <section className="space-y-4">
            <h2 className="text-titre-2 text-encre">{t("demande.vosInformations")}</h2>

            <Champ
              libelle={t("demande.nomComplet")}
              name="nom"
              autoComplete="name"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              erreur={erreurs.nom ? t("demande.nomRequis") : undefined}
            />
            <Champ
              libelle={t("demande.email")}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              erreur={erreurs.email ? t("demande.emailRequis") : undefined}
            />

            <div className="flex gap-3">
              <label className="flex shrink-0 flex-col gap-1">
                <span className="text-petit text-encre">{t("demande.pays")}</span>
                <select
                  value={indicatif}
                  onChange={(e) => setIndicatif(e.target.value)}
                  className="min-h-[var(--size-control)] w-[112px] rounded-control border border-contour-champ bg-surface px-2 text-corps text-encre chiffres-tabulaires"
                >
                  {INDICATIFS.map((i) => (
                    <option key={i.code} value={i.code} title={i.pays}>
                      {i.drapeau} {i.code}
                    </option>
                  ))}
                </select>
              </label>
              <Champ
                libelle={t("demande.telephone")}
                name="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                tabulaire
                className="min-w-0 flex-1"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                erreur={erreurs.telephone ? t("demande.telephoneRequis") : undefined}
              />
            </div>
          </section>

          <section className="rounded-card border border-contour bg-surface p-4">
            <Compteur
              libelle={t("demande.nombreVoyageurs")}
              valeur={voyageurs}
              min={1}
              max={logement.capacite}
              onChange={setVoyageurs}
            />
          </section>

          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-petit text-encre">
              {t("demande.messageOptionnel")}
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("demande.messagePlaceholder2")}
              className="rounded-control border border-contour-champ bg-surface px-3 py-2 text-corps text-encre outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primaire"
            />
          </div>

          <Bouton type="submit" variante="principal" largeur="pleine">
            {t("demande.continuer")}
          </Bouton>
        </form>
      ) : (
        <div className="space-y-6">
          {/* rappel de l'offre */}
          <Carte className="flex gap-4 p-4">
            <span className="relative h-20 w-24 shrink-0 overflow-hidden rounded-control bg-champ">
              <Image
                src={logement.photos[0].url}
                alt={logement.photos[0].alt}
                fill
                sizes="96px"
                className="object-cover"
              />
            </span>
            <div className="min-w-0">
              <p className="text-titre-3 text-encre">{logement.titre}</p>
              <p className="mt-1 flex items-center gap-1.5 text-petit text-encre-douce">
                <Icone nom="repere" taille={16} />
                {logement.quartier}, {logement.ville}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-petit text-encre-douce chiffres-tabulaires">
                <Icone nom="calendrier" taille={16} />
                {formaterDateComplete(new Date(`${debut}T00:00:00`), langue)} →{" "}
                {formaterDateComplete(new Date(`${fin}T00:00:00`), langue)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-petit text-encre-douce">
                <Icone nom="personnes" taille={16} />
                {t("recherche.nombreVoyageurs", { nombre: voyageurs })}
              </p>
            </div>
          </Carte>

          <section>
            <h2 className="mb-3 text-titre-2 text-encre">{t("demande.detailDuPrix")}</h2>
            <dl className="space-y-2 border-b border-contour pb-4">
              <Ligne
                terme={t("fiche.detailNuits", {
                  prix: formaterPrix(logement.prixParNuit, langue),
                  nuits: t("fiche.nuits", { nombre: nuits }),
                })}
                valeur={formaterPrix(sousTotal, langue)}
              />
              {fraisFixes.map((frais) => (
                <Ligne
                  key={frais.libelle}
                  terme={frais.libelle}
                  valeur={formaterPrix(frais.montant, langue)}
                />
              ))}
              {/* Zéro, et affiché : c'est la preuve de « aucun frais caché ». */}
              <Ligne terme={t("demande.fraisDeService")} valeur={formaterPrix(0, langue)} />
            </dl>
            <p className="mt-4 flex items-baseline justify-between text-prix text-encre chiffres-tabulaires">
              <span className="text-corps font-normal text-encre-douce">{t("fiche.total")}</span>
              {formaterPrix(total, langue)}
            </p>
            <PrixConverti montant={total} className="mt-1 block text-right text-legende text-encre-douce" />
            <p className="mt-2 text-legende text-encre-douce">{t("demande.prixFige")}</p>
          </section>

          <Bandeau variante="information">
            <strong className="block font-semibold">{t("resultats.paiementSurPlace")}</strong>
            {t("demande.paiementDirect")}
          </Bandeau>

          {!enLigne && <Bandeau variante="hors-connexion">{t("horsLigne.envoiDesactive")}</Bandeau>}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Bouton
              variante="principal"
              largeur="pleine"
              enCours={enCours}
              disabled={!enLigne}
              onClick={() => {
                if (visiteur) {
                  // Session valide : aucun code à redemander (§B.1).
                  void envoyer();
                } else {
                  setEtatCode("inconnu");
                  setFeuilleCode(true);
                  void demanderCode();
                }
              }}
            >
              {t("demande.envoyerMaDemande")}
            </Bouton>
            <Bouton variante="secondaire" largeur="pleine" onClick={() => setEtape(1)}>
              {t("demande.retour")}
            </Bouton>
          </div>

          <p className="text-center text-petit text-encre-douce">{t("demande.delaiReponse")}</p>
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
              enCours
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
                    : // Le code fixe n'existe que dans le mock. L'annoncer quand
                      // la vraie API répond, c'était afficher « le code est
                      // 123456 » sur le site public.
                      indiceDemo
            }
          />

          <Bouton
            variante="principal"
            largeur="pleine"
            enCours={enCours}
            disabled={code.length < 6}
            onClick={() => envoyer(code)}
          >
            {t("demande.envoyerMaDemande")}
          </Bouton>

          <Bouton
            variante="secondaire"
            largeur="pleine"
            disabled={compteARebours > 0}
            onClick={() => {
              setCompteARebours(SECONDES_AVANT_RENVOI);
              void demanderCode();
            }}
          >
            {compteARebours > 0
              ? t("demande.codeRenvoyerDans", { secondes: compteARebours })
              : t("demande.codeRenvoyer")}
          </Bouton>

          {/*
            La sortie vers un vrai compte. La saisie est mise de côté côté
            serveur avant de quitter la page : au retour, le récapitulatif est
            rétabli tel quel et la demande part sans nouveau code.
          */}
          <p className="text-center text-petit text-encre-douce">
            {t("demande.plutotUnCompte")}{" "}
            <button
              type="button"
              className="font-semibold text-primaire underline underline-offset-2"
              onClick={() =>
                void mettreDemandeDeCoteEtSInscrire(
                  {
                    genre: "logement",
                    logementId: logement.id,
                    debut,
                    fin,
                    personnes: voyageurs,
                    nom,
                    email,
                    telephone,
                    message,
                  },
                  `/demande/${logement.id}?debut=${debut}&fin=${fin}&personnes=${voyageurs}`,
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

/** « Jamais d'impasse » : le logement est parti, trois autres sont proposés (§B.8). */
function Alternatives({ logements }: { logements: Logement[] }) {
  const t = useT();
  const langue = useLangue();

  return (
    <div className="space-y-5">
      <Bandeau variante="avertissement">
        <strong className="block font-semibold">{t("demande.prisTitre")}</strong>
        {t("demande.prisTexte")}
      </Bandeau>

      <ul className="grid gap-4 sm:grid-cols-3">
        {logements.map((autre) => (
          <li key={autre.id}>
            <Carte className="h-full">
              <Lien href={`/logements/${autre.slug}`} className="block p-4">
                <p className="text-titre-3 text-encre">{autre.titre}</p>
                <p className="mt-1 text-petit text-encre-douce">
                  {autre.quartier}, {autre.ville}
                </p>
                <p className="mt-3 text-prix text-encre chiffres-tabulaires">
                  {formaterPrix(autre.prixParNuit, langue)}
                  <span className="ml-1 text-petit font-normal text-encre-douce">
                    {t("commun.parNuit")}
                  </span>
                </p>
              </Lien>
            </Carte>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-corps text-encre-douce">{terme}</dt>
      <dd className="text-corps font-semibold text-encre chiffres-tabulaires">{valeur}</dd>
    </div>
  );
}
