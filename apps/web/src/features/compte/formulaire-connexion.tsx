"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Bandeau, Bouton, Champ, ChampCode } from "@teranga/ui";
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
 * Il n'y a pas de lien « mot de passe oublié » : aucun parcours de
 * réinitialisation n'est implémenté, et un lien qui mène à une page vide est
 * pire que son absence. En attendant, le chemin par code **est** la solution de
 * repli — il ne demande rien d'autre que l'accès à sa boîte e-mail, ce qu'une
 * réinitialisation exigerait de toute façon.
 *
 * Deux `<form>` distincts, parce qu'un formulaire ne s'imbrique pas : chacun a
 * sa Server Action, et l'adresse e-mail est partagée par l'état du composant.
 */
export function FormulaireConnexionVisiteur({ suite }: { suite: string }) {
  const t = useT();
  const langue = useLangue();

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");

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

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifiant.trim());
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

  return (
    <div className="space-y-6">
      {/* ─────────── 1. Adresse et mot de passe ─────────── */}
      <form action={actionMotDePasse} className="space-y-4">
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

        <Champ
          libelle={t("compte.identifiant")}
          name="identifiant"
          type="text"
          inputMode="email"
          autoComplete="email"
          required
          value={identifiant}
          onChange={(e) => {
            setIdentifiant(e.target.value);
            setErreurEnvoi(null);
          }}
          erreur={etatCode.erreur === "identifiant" ? t("compte.identifiantErreur") : undefined}
        />

        <Champ
          libelle={t("compte.motDePasse")}
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />

        <Bouton
          type="submit"
          variante="principal"
          largeur="pleine"
          enCours={connexionEnCours}
          disabled={!emailValide || motDePasse.length === 0}
        >
          {t("compte.seConnecterMotDePasse")}
        </Bouton>
      </form>

      {/* ─────────── 2. Ou un code par e-mail ─────────── */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-contour" />
        <span className="text-petit text-encre-douce">{t("compte.ouParCode")}</span>
        <span className="h-px flex-1 bg-contour" />
      </div>

      <p className="text-petit text-encre-douce">{t("compte.parCodeTexte")}</p>

      <div className="flex justify-end">
        <Bouton
          type="button"
          variante="secondaire"
          onClick={demanderCode}
          disabled={!identifiantValide || envoiEnCours || compteARebours > 0}
          enCours={envoiEnCours}
          className="text-xs"
        >
          {compteARebours > 0
            ? `Renvoyer le code (${compteARebours}s)`
            : codeEnvoye
              ? "Renvoyer un nouveau code"
              : "Recevoir un code de vérification"}
        </Bouton>
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
            verificationEnCours ? "verification" : etatCode.erreur === "code" ? "erreur" : "vide"
          }
          message={
            etatCode.erreur === "code" ? etatCode.message || t("compte.codeErreur") : undefined
          }
        />

        <Bouton
          type="submit"
          variante="secondaire"
          largeur="pleine"
          enCours={verificationEnCours}
          disabled={code.length < 6}
        >
          {t("compte.connexionTitre")}
        </Bouton>
      </form>
    </div>
  );
}
