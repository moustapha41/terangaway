"use client";

import { useActionState, useState } from "react";
import { Bouton, Champ, ChampCode } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { seConnecter, type EtatConnexion } from "./actions";

/** Numéro puis code, sur une seule page : le partenaire ne doit pas naviguer. */
export function FormulaireConnexion() {
  const t = useT();
  const [code, setCode] = useState("");
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(seConnecter, {});

  return (
    <form action={action} className="space-y-5">
      <Champ
        libelle={t("prestataire.telephone")}
        aide={t("prestataire.telephoneAide")}
        icone="telephone"
        name="telephone"
        type="tel"
        inputMode="tel"
        defaultValue="+221 77 000 00 00"
        required
        erreur={etat.erreur === "telephone" ? t("prestataire.telephoneErreur") : undefined}
      />

      <input type="hidden" name="code" value={code} />
      <ChampCode
        libelle={t("prestataire.code")}
        valeur={code}
        onChange={setCode}
        etat={enCours ? "verification" : etat.erreur === "code" ? "erreur" : "vide"}
        message={etat.erreur === "code" ? t("prestataire.codeErreur") : undefined}
      />

      <Bouton type="submit" variante="principal" largeur="pleine" enCours={enCours} disabled={code.length < 6}>
        {t("prestataire.seConnecter")}
      </Bouton>
    </form>
  );
}
