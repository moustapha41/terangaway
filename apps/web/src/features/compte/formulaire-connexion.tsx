"use client";

import { useActionState, useState } from "react";
import { Bouton, Champ, ChampCode } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { seConnecter, type EtatConnexionVisiteur } from "./actions";

/** E-mail **ou** téléphone, puis code : « le code suffit » (§D.1). */
export function FormulaireConnexionVisiteur({ suite }: { suite: string }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [etat, action, enCours] = useActionState<EtatConnexionVisiteur, FormData>(seConnecter, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="suite" value={suite} />

      <Champ
        libelle={t("compte.identifiant")}
        name="identifiant"
        type="text"
        inputMode="email"
        autoComplete="email"
        required
        erreur={etat.erreur === "identifiant" ? t("compte.identifiantErreur") : undefined}
      />

      <input type="hidden" name="code" value={code} />
      <ChampCode
        libelle={t("demande.codeLibelle")}
        valeur={code}
        onChange={setCode}
        etat={enCours ? "verification" : etat.erreur === "code" ? "erreur" : "vide"}
        message={etat.erreur === "code" ? t("compte.codeErreur") : undefined}
      />

      <Bouton type="submit" variante="principal" largeur="pleine" enCours={enCours} disabled={code.length < 6}>
        {t("compte.connexionTitre")}
      </Bouton>
    </form>
  );
}
