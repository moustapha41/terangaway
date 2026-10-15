"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Bandeau, Bouton, ChampCode } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { apiMockActive } from "@/lib/api/http";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import {
  abandonnerInscriptionAction,
  renvoyerCodeInscriptionAction,
  verifierInscriptionAction,
  type EtatVerification,
} from "./inscription-actions";

/**
 * Vérification de l'adresse : six cases, un renvoi, une sortie.
 *
 * L'adresse n'est pas dans ce formulaire. Elle vit dans le cookie d'attente,
 * que seul le serveur lit : soumettre l'adresse depuis la page permettrait
 * d'essayer un code deviné contre l'adresse de quelqu'un d'autre.
 *
 * Le code n'est jamais affiché, et aucune valeur de code n'est écrite ici —
 * sauf l'indice de démonstration, qui ne sort que lorsque le mock répond.
 */
const SECONDES_AVANT_RENVOI = 60;

export function FormulaireVerificationInscription() {
  const t = useT();
  const langue = useLangue();
  const [etat, action, enCours] = useActionState<EtatVerification, FormData>(
    verifierInscriptionAction,
    {},
  );

  const [code, setCode] = useState("");
  const [compteARebours, setCompteARebours] = useState(SECONDES_AVANT_RENVOI);
  const [renvoye, setRenvoye] = useState(false);
  const [erreurRenvoi, setErreurRenvoi] = useState<string | null>(null);
  const [renvoiEnCours, demarrerRenvoi] = useTransition();
  const [abandonEnCours, demarrerAbandon] = useTransition();

  useEffect(() => {
    if (compteARebours <= 0) return;
    const minuterie = setInterval(() => setCompteARebours((reste) => reste - 1), 1000);
    return () => clearInterval(minuterie);
  }, [compteARebours]);

  /** L'indice de démonstration, et seulement là où il est vrai. */
  const indiceDemo = apiMockActive()
    ? t("demande.codeDemo", { code: CODE_DE_DEMONSTRATION })
    : undefined;

  function renvoyer() {
    if (renvoiEnCours || compteARebours > 0) return;
    setErreurRenvoi(null);
    setRenvoye(false);

    demarrerRenvoi(async () => {
      const resultat = await renvoyerCodeInscriptionAction();
      if (resultat.succes) {
        setRenvoye(true);
        setCode("");
        setCompteARebours(resultat.delaiAttenteSecondes || SECONDES_AVANT_RENVOI);
      } else {
        setErreurRenvoi(resultat.message);
      }
    });
  }

  /** L'inscription a expiré ou l'adresse est inconnue : il faut tout reprendre. */
  const aReprendre = etat.erreur === "introuvable";

  const messageSousLeCode =
    etat.message ??
    (renvoye ? t("inscription.codeRenvoye") : undefined) ??
    indiceDemo;

  return (
    <div className="space-y-5">
      {aReprendre && (
        <Bandeau variante="avertissement">{etat.message ?? t("inscription.attenteExpiree")}</Bandeau>
      )}

      {erreurRenvoi && <Bandeau variante="erreur">{erreurRenvoi}</Bandeau>}

      <form action={action} className="space-y-5">
        <input type="hidden" name="langue" value={langue} />
        <input type="hidden" name="code" value={code} />

        <ChampCode
          libelle={t("inscription.codeLibelle")}
          valeur={code}
          onChange={setCode}
          etat={
            enCours
              ? "verification"
              : etat.erreur === "expire"
                ? "expire"
                : etat.erreur
                  ? "erreur"
                  : "vide"
          }
          message={messageSousLeCode}
        />

        <Bouton
          type="submit"
          variante="principal"
          largeur="pleine"
          enCours={enCours}
          disabled={code.length < 6 || aReprendre}
        >
          {t("inscription.verifierMonCompte")}
        </Bouton>
      </form>

      <Bouton
        type="button"
        variante="secondaire"
        largeur="pleine"
        onClick={renvoyer}
        enCours={renvoiEnCours}
        disabled={compteARebours > 0 || renvoiEnCours || aReprendre}
      >
        {compteARebours > 0
          ? t("inscription.renvoyerDans", { secondes: compteARebours })
          : t("inscription.renvoyerCode")}
      </Bouton>

      {/*
        La sortie : revenir corriger l'adresse. Sans elle, une faute de frappe
        dans l'adresse enferme la personne sur un écran qui attend un code qui
        n'arrivera jamais.
      */}
      <p className="text-center text-petit text-encre-douce">
        {t("inscription.corrigerEmail")}{" "}
        <button
          type="button"
          onClick={() => demarrerAbandon(() => abandonnerInscriptionAction(langue))}
          disabled={abandonEnCours}
          className="font-semibold text-primaire underline underline-offset-2 disabled:opacity-60"
        >
          {t("inscription.corrigerEmailAction")}
        </button>
      </p>
    </div>
  );
}
