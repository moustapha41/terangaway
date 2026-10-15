"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Bandeau, Bouton, Champ, ChampCode } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { demanderCodeOtpAction, seConnecter, type EtatConnexionVisiteur } from "./actions";

/** E-mail ou téléphone, réception du code puis validation de session. */
export function FormulaireConnexionVisiteur({ suite }: { suite: string }) {
  const t = useT();
  const [identifiant, setIdentifiant] = useState("");
  const [code, setCode] = useState("");
  const [etat, action, enCours] = useActionState<EtatConnexionVisiteur, FormData>(seConnecter, {});

  const [envoiEnCours, startTransition] = useTransition();
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [compteARebours, setCompteARebours] = useState(0);

  useEffect(() => {
    if (compteARebours <= 0) return;
    const minuterie = setInterval(() => {
      setCompteARebours((s) => s - 1);
    }, 1000);
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

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="suite" value={suite} />

      <div className="space-y-2">
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
          erreur={
            etat.erreur === "identifiant"
              ? t("compte.identifiantErreur")
              : undefined
          }
        />

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
      </div>

      {codeEnvoye && (
        <Bandeau variante="information">
          Un code de vérification à 6 chiffres a été envoyé à votre adresse e-mail. Il est valable pendant 10 minutes.
        </Bandeau>
      )}

      {erreurEnvoi && (
        <Bandeau variante="avertissement">
          {erreurEnvoi}
        </Bandeau>
      )}

      <input type="hidden" name="code" value={code} />
      <ChampCode
        libelle={t("demande.codeLibelle")}
        valeur={code}
        onChange={setCode}
        etat={enCours ? "verification" : etat.erreur === "code" ? "erreur" : "vide"}
        message={
          etat.erreur === "code"
            ? (etat.message || t("compte.codeErreur"))
            : undefined
        }
      />

      <Bouton
        type="submit"
        variante="principal"
        largeur="pleine"
        enCours={enCours}
        disabled={code.length < 6}
      >
        {t("compte.connexionTitre")}
      </Bouton>
    </form>
  );
}
