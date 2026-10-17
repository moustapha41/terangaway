"use client";

import { useState, useTransition } from "react";
import { Bandeau, Bouton, Carte, Champ } from "@teranga/ui";
import { connexionAdminAction, envoyerCodeAdminAction } from "./actions";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";

/**
 * Connexion de l'équipe, en deux temps : l'adresse, puis le code.
 *
 * L'écran ne dit jamais si l'adresse existe ni si elle est administratrice —
 * le premier écran répond la même chose à tout le monde. Le refus de rôle
 * n'arrive qu'après un code correct, c'est-à-dire à quelqu'un qui possède
 * déjà la boîte aux lettres.
 */
export function FormulaireConnexionAdmin({
  desactive = false,
}: {
  /** Quand le site est encore en mock : le formulaire ne sert à rien. */
  desactive?: boolean;
}) {
  const t = useT();
  const naviguer = useNaviguer();
  const [etape, setEtape] = useState<"adresse" | "code">("adresse");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const demanderCode = () =>
    demarrer(async () => {
      setErreur(null);
      const { envoye, codeDemo, motif } = await envoyerCodeAdminAction(email);
      if (!envoye) {
        setErreur(
          motif === "injoignable"
            ? t("admin.erreurServeur")
            : motif === "envoi"
              ? t("admin.erreurEnvoi")
              : motif === "trop"
                ? t("admin.erreurTropDeCodes")
                : t("admin.erreurAdresse"),
        );
        return;
      }
      setNote(
        codeDemo
          ? `${t("admin.codeEnvoye")} ${t("compte.codeDemo", { code: codeDemo })}`
          : t("admin.codeEnvoye"),
      );
      setEtape("code");
    });

  const entrer = () =>
    demarrer(async () => {
      setErreur(null);
      const resultat = await connexionAdminAction(email, code);
      if (resultat.succes) {
        naviguer("/admin");
        return;
      }
      setNote(null);
      setErreur(
        resultat.erreur === "role"
          ? t("admin.erreurRole")
          : resultat.erreur === "code"
            ? t("admin.erreurCode")
            : t("admin.erreurServeur"),
      );
    });

  return (
    <Carte className="mx-auto max-w-[460px] p-6">
      <h1 className="text-titre-1 text-encre">{t("admin.connexionTitre")}</h1>
      <p className="mt-2 text-petit text-encre-douce">{t("admin.connexionTexte")}</p>

      {note && (
        <div className="mt-4">
          <Bandeau variante="information">{note}</Bandeau>
        </div>
      )}
      {erreur && (
        <div className="mt-4">
          <Bandeau variante="erreur">{erreur}</Bandeau>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <Champ
          libelle={t("admin.email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={desactive || etape === "code"}
        />

        {etape === "code" && (
          <Champ
            libelle={t("admin.code")}
            inputMode="numeric"
            autoComplete="one-time-code"
            tabulaire
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            disabled={desactive}
          />
        )}

        <Bouton
          variante="principal"
          largeur="pleine"
          enCours={enCours}
          disabled={desactive}
          onClick={etape === "adresse" ? demanderCode : entrer}
        >
          {etape === "adresse" ? t("admin.envoyerCode") : t("admin.entrer")}
        </Bouton>
      </div>
    </Carte>
  );
}
