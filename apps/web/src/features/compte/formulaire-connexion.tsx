"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Bandeau, ChampCode } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { Lien } from "@/lib/i18n/lien";
import { demanderCodeOtpAction, seConnecter, type EtatConnexionVisiteur } from "./actions";
import {
  connexionMotDePasseAction,
  type EtatConnexionMotDePasse,
} from "./inscription-actions";

/**
 * Connexion d'un compte existant — deux chemins, volontairement.
 *
 * 1. **Mot de passe**, pour les comptes créés par `/inscription`.
 * 2. **Code à six chiffres**, pour tous les comptes antérieurs.
 *
 * Le second n'est pas un reliquat à retirer : les comptes nés avant le mot de
 * passe n'en ont pas, leur colonne est `NULL`, et le code est leur seul moyen
 * d'entrer. Supprimer ce chemin les enfermerait dehors.
 *
 * La maquette montre un lien « Mot de passe oublié ? ». Aucun parcours de
 * réinitialisation n'existe — mais le chemin par code **est** la solution de
 * repli : il ne demande rien d'autre que l'accès à sa boîte e-mail, ce qu'une
 * réinitialisation exigerait de toute façon. Le lien de la maquette ouvre donc
 * ce chemin, replié par défaut, au lieu de mener à une page vide.
 *
 * Deux `<form>` distincts, parce qu'un formulaire ne s'imbrique pas : chacun a
 * sa Server Action, et l'adresse e-mail est partagée par l'état du composant.
 */
export function FormulaireConnexionVisiteur({
  suite,
  codeDemo,
  googleActif = false,
}: {
  suite: string;
  /** Google n'est proposé que si le serveur a ses identifiants. */
  googleActif?: boolean;
  /**
   * Le code fixe du mock, passé par la page plutôt que lu ici : `mocks/api`
   * embarque tout le catalogue, et ce composant part dans le navigateur.
   * Absent face à la vraie API, où ce code est refusé.
   */
  codeDemo?: string;
}) {
  const t = useT();
  const langue = useLangue();

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [code, setCode] = useState("");
  const [parCodeOuvert, setParCodeOuvert] = useState(false);
  const [fournisseurDemande, setFournisseurDemande] = useState<string | null>(null);

  const [etatMotDePasse, actionMotDePasse, connexionEnCours] = useActionState<
    EtatConnexionMotDePasse,
    FormData
  >(connexionMotDePasseAction, {});

  const [etatCode, actionCode, verificationEnCours] = useActionState<
    EtatConnexionVisiteur,
    FormData
  >(seConnecter, {});

  const [envoiEnCours, startTransition] = useTransition();
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [compteARebours, setCompteARebours] = useState(0);

  useEffect(() => {
    if (compteARebours <= 0) return;
    const minuterie = setInterval(() => setCompteARebours((s) => s - 1), 1000);
    return () => clearInterval(minuterie);
  }, [compteARebours]);

  const identifiantValide = identifiant.trim().length >= 6;

  function demanderCode() {
    if (!identifiantValide || envoiEnCours || compteARebours > 0) return;
    setErreurEnvoi(null);

    if (!identifiant.includes("@")) {
      setErreurEnvoi(
        "L'envoi de codes par SMS n'est pas disponible pour le moment. Veuillez saisir votre adresse e-mail pour recevoir votre code de vérification.",
      );
      return;
    }

    startTransition(async () => {
      const resultat = await demanderCodeOtpAction(identifiant);
      if (resultat.succes) {
        setCodeEnvoye(true);
        setCompteARebours(resultat.delaiAttenteSecondes || 60);
      } else {
        setErreurEnvoi(resultat.erreur);
      }
    });
  }

  function ouvrirParCode() {
    setParCodeOuvert(true);
    setFournisseurDemande(null);
    if (identifiantValide && !codeEnvoye) demanderCode();
  }

  return (
    <div className="space-y-4 [@media(max-height:860px)]:space-y-2.5">
      {/* ─────────── 1. Adresse et mot de passe ─────────── */}
      <form action={actionMotDePasse} className="space-y-3 [@media(max-height:860px)]:space-y-2">
        <input type="hidden" name="suite" value={suite} />
        <input type="hidden" name="langue" value={langue} />
        <input type="hidden" name="email" value={identifiant.trim().toLowerCase()} />

        {etatMotDePasse.erreur === "non_verifie" ? (
          <Bandeau
            variante="avertissement"
            action={
              <Lien
                href="/inscription/verification"
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                {t("compte.allerVerifier")}
              </Lien>
            }
          >
            {etatMotDePasse.message ?? t("compte.compteNonVerifie")}
          </Bandeau>
        ) : (
          etatMotDePasse.message && (
            <Bandeau variante="erreur">
              <strong className="block font-semibold">{t("compte.connexionEchec")}</strong>
              {etatMotDePasse.message}
            </Bandeau>
          )
        )}

        <Cadre icone={<Mail strokeWidth={1.8} className="h-[20px] w-[20px]" />}>
          <label htmlFor="connexion-identifiant" className="sr-only">
            {t("compte.adresseEmail")}
          </label>
          <input
            id="connexion-identifiant"
            name="identifiant"
            type="text"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={t("compte.adresseEmail")}
            value={identifiant}
            onChange={(e) => {
              setIdentifiant(e.target.value);
              setErreurEnvoi(null);
            }}
            className={CHAMP}
          />
        </Cadre>
        {etatCode.erreur === "identifiant" && (
          <p className="px-1 text-[13px] text-danger">{t("compte.identifiantErreur")}</p>
        )}

        <Cadre
          icone={<Lock strokeWidth={1.8} className="h-[20px] w-[20px]" />}
          apres={
            <button
              type="button"
              onClick={() => setMotDePasseVisible((v) => !v)}
              aria-label={
                motDePasseVisible ? t("compte.masquerMotDePasse") : t("compte.afficherMotDePasse")
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-encre-douce transition-colors hover:text-encre"
            >
              {motDePasseVisible ? (
                <EyeOff strokeWidth={1.8} className="h-[20px] w-[20px]" />
              ) : (
                <Eye strokeWidth={1.8} className="h-[20px] w-[20px]" />
              )}
            </button>
          }
        >
          <label htmlFor="connexion-mot-de-passe" className="sr-only">
            {t("compte.motDePasse")}
          </label>
          <input
            id="connexion-mot-de-passe"
            name="motDePasse"
            type={motDePasseVisible ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder={t("compte.motDePasse")}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className={CHAMP}
          />
        </Cadre>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
          {/* Décochée, comme sur la maquette. La session dure trente jours dans
              tous les cas : l'infobulle le dit plutôt que de laisser croire que
              la case y change quelque chose. */}
          <label className="inline-flex items-center gap-2.5 text-[14px] text-encre">
            <input
              type="checkbox"
              name="seSouvenir"
              title={t("compte.seSouvenirSansEffet")}
              className="h-[18px] w-[18px] shrink-0 rounded-[5px] border-contour-champ accent-primaire"
            />
            {t("compte.seSouvenir")}
          </label>

          <button
            type="button"
            onClick={ouvrirParCode}
            className="text-[14px] font-semibold text-primaire underline underline-offset-4"
          >
            {t("compte.motDePasseOublie")}
          </button>
        </div>

        {/* Toujours au bleu de la maquette, jamais grisé : les deux champs sont
            `required`, c'est le navigateur qui retient une saisie incomplète et
            qui dit lequel manque. Un bouton éteint ne l'aurait pas dit. */}
        <button
          type="submit"
          disabled={connexionEnCours}
          className={
            "flex h-[50px] [@media(max-height:860px)]:h-[44px] w-full items-center justify-center gap-2.5 rounded-pill bg-primaire " +
            "text-[16px] font-semibold text-white transition-opacity " +
            "hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 " +
            "focus-visible:outline-primaire disabled:opacity-45"
          }
        >
          {t("compte.connexionTitre")}
          <ArrowRight strokeWidth={2.2} className="h-5 w-5" />
        </button>
      </form>

      {/* ─────────── 2. Le fournisseur tiers ─────────── */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-contour" />
        <span className="text-[14px] text-encre-douce">{t("compte.ou")}</span>
        <span className="h-px flex-1 bg-contour" />
      </div>

      {/* Google seul : Apple a été retiré à la demande du client. Un seul
          fournisseur, donc pleine largeur.

          Un lien, pas un bouton, quand c'est configuré : le départ vers Google
          est une navigation, elle doit s'ouvrir dans un nouvel onglet au clic
          du milieu et se copier au clic droit comme n'importe quelle adresse. */}
      <BoutonFournisseur
        nom="Google"
        icone={<LogoGoogle />}
        href={
          googleActif
            ? `/api/auth/google?langue=${langue}&suite=${encodeURIComponent(suite)}`
            : undefined
        }
        onClick={googleActif ? undefined : () => setFournisseurDemande("Google")}
        libelle={t("compte.continuerAvec", { fournisseur: "Google" })}
      />

      {fournisseurDemande && (
        <Bandeau variante="information">
          {t("compte.fournisseurIndisponible", { fournisseur: fournisseurDemande })}
        </Bandeau>
      )}

      {/* ─────────── 3. Le code par e-mail, replié ─────────── */}
      {parCodeOuvert && (
        <div className="space-y-4 rounded-card border border-contour bg-champ/60 p-4">
          <p className="text-petit text-encre-douce">{t("compte.parCodeTexte")}</p>

          {codeDemo && (
            <Bandeau variante="information">
              {t("compte.codeDemo", { code: codeDemo })}
            </Bandeau>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={demanderCode}
              disabled={!identifiantValide || envoiEnCours || compteARebours > 0}
              className="text-[13px] font-semibold text-primaire underline underline-offset-4 disabled:opacity-50 disabled:no-underline"
            >
              {compteARebours > 0
                ? `Renvoyer le code (${compteARebours}s)`
                : codeEnvoye
                  ? "Renvoyer un nouveau code"
                  : "Recevoir un code de vérification"}
            </button>
          </div>

          {codeEnvoye && (
            <Bandeau variante="information">
              Un code de vérification à 6 chiffres a été envoyé à votre adresse e-mail. Il est valable pendant 10 minutes.
            </Bandeau>
          )}

          {erreurEnvoi && <Bandeau variante="avertissement">{erreurEnvoi}</Bandeau>}

          <form action={actionCode} className="space-y-4">
            <input type="hidden" name="suite" value={suite} />
            <input type="hidden" name="identifiant" value={identifiant} />
            <input type="hidden" name="code" value={code} />

            <ChampCode
              libelle={t("demande.codeLibelle")}
              valeur={code}
              onChange={setCode}
              etat={
                verificationEnCours
                  ? "verification"
                  : etatCode.erreur === "code"
                    ? "erreur"
                    : "vide"
              }
              message={
                etatCode.erreur === "code" ? etatCode.message || t("compte.codeErreur") : undefined
              }
            />

            <button
              type="submit"
              disabled={code.length < 6 || verificationEnCours}
              className={
                "h-[48px] w-full rounded-pill border border-primaire text-[15px] font-semibold " +
                "text-primaire transition-colors hover:bg-primaire/5 disabled:opacity-45"
              }
            >
              {t("compte.connexionTitre")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const CHAMP =
  "min-w-0 flex-1 bg-transparent text-[16px] text-encre outline-none placeholder:text-encre-douce";

/** Le cadre des champs de la maquette : 56 px, fond gris très clair, icône à gauche. */
function Cadre({
  icone,
  apres,
  children,
}: {
  icone: React.ReactNode;
  apres?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "flex h-[50px] [@media(max-height:860px)]:h-[44px] items-center gap-3 rounded-[14px] border border-contour-champ bg-champ/60 px-4 " +
        "transition-colors focus-within:border-primaire/40 focus-within:bg-surface"
      }
    >
      <span className="shrink-0 text-encre-douce">{icone}</span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
      {apres}
    </div>
  );
}

function BoutonFournisseur({
  nom,
  icone,
  libelle,
  onClick,
  href,
}: {
  nom: string;
  icone: React.ReactNode;
  libelle: string;
  onClick?: () => void;
  href?: string;
}) {
  const Balise = href ? "a" : "button";
  return (
    <Balise
      {...(href ? { href } : { type: "button" as const })}
      onClick={onClick}
      className={
        "flex h-[46px] [@media(max-height:860px)]:h-[41px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-contour " +
        "bg-surface/80 px-3 text-[13.5px] text-encre transition-colors hover:bg-champ " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
      }
    >
      {icone}
      <span className="truncate">
        {libelle.replace(nom, "")}
        <strong className="font-semibold">{nom}</strong>
      </span>
    </Balise>
  );
}

function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[19px] w-[19px] shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4Z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1Z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48Z" />
    </svg>
  );
}
