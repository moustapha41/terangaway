"use client";

import { useTransition } from "react";
import { Bouton } from "@teranga/ui";
import { deconnexionAdminAction } from "./actions";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";

/** Le bouton de sortie du backoffice : il efface le cookie, puis ramène à la connexion. */
export function BarreAdmin() {
  const t = useT();
  const naviguer = useNaviguer();
  const [enCours, demarrer] = useTransition();

  return (
    <Bouton
      variante="secondaire"
      largeur="contenu"
      enCours={enCours}
      onClick={() =>
        demarrer(async () => {
          await deconnexionAdminAction();
          naviguer("/admin/connexion");
        })
      }
    >
      {t("admin.deconnexion")}
    </Bouton>
  );
}
