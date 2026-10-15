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
import { CODE_DE_DEMONSTRATION, type EtatEnvoi } from "@/mocks/api";

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
}: {
  logement: Logement;
  debut: string;
  fin: string;
  personnes: number;
  etatSimule: EtatEnvoi;
}) {
  const t = useT();
  const langue = useLangue();
  const naviguer = useNaviguer();
  const enLigne = useEnLigne();

  const [etape, setEtape] = useState<1 | 2>(1);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [indicatif, setIndicatif] = useState("+221");
  const [telephone, setTelephone] = useState("");
  const [voyageurs, setVoyageurs] = useState(personnes);
  const [message, setMessage] = useState("");

  const [code, setCode] = useState("");
  const [feuilleCode, setFeuilleCode] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurCode, setErreurCode] = useState<"faux" | "expire" | null>(null);
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
        naviguer(`/demande/confirmation?reference=${resultat.demande.reference}`);
        return;
      }

      if (resultat.erreur === "code_invalide") {
        setErreurCode(resultat.raison ?? "faux");
        setCode("");
      } else if (resultat.erreur === "logement_pris") {
        setFeuilleCode(false);
        setPris(resultat.alternatives ?? []);
      }
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
              onClick={() => setFeuilleCode(true)}
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
        titre={t("demande.codeTitre")}
        etiquetteFermer={t("demande.fermer")}
      >
        <div className="space-y-5">
          <p className="text-corps text-encre-douce">{t("demande.codeTexte")}</p>

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
                  : t("demande.codeDemo", { code: CODE_DE_DEMONSTRATION })
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
              setErreurCode(null);
            }}
          >
            {compteARebours > 0
              ? t("demande.codeRenvoyerDans", { secondes: compteARebours })
              : t("demande.codeRenvoyer")}
          </Bouton>
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
