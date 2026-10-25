"use server";

import { redirect } from "next/navigation";
import { ouvrirSession } from "@/features/compte/actions";
import { ErreurApi } from "@/lib/api/http";
import { apiOuvrirLienDemande } from "@/lib/api/ecriture";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { REFUS_LIEN, type RefusLien } from "./refus-lien";

/**
 * Échange le lien reçu par e-mail contre une session, puis ouvre la demande.
 *
 * Appelée par un bouton, jamais au simple chargement de la page : les
 * antivirus et les aperçus de messagerie suivent les liens, et un lien à usage
 * unique consommé par un robot serait perdu pour son destinataire.
 *
 * La destination est l'identifiant renvoyé par l'API pour **ce** jeton, pas
 * une valeur lue dans l'URL ; la page de la demande revérifie de son côté que
 * la session est bien celle du propriétaire.
 */
export async function ouvrirDemandeParLien(formData: FormData): Promise<void> {
  const jeton = String(formData.get("jeton") ?? "");
  const brut = String(formData.get("locale") ?? "fr");
  const langue: Langue = estLangue(brut) ? brut : "fr";

  let refus: RefusLien = "LIEN_INVALIDE";
  let destination: string | null = null;

  try {
    const ouverture = await apiOuvrirLienDemande(jeton);
    if (await ouvrirSession(ouverture.token)) {
      destination = `/${langue}/mes-demandes/${encodeURIComponent(ouverture.demandeId)}`;
    }
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (REFUS_LIEN as readonly string[]).includes(erreur.code)) {
      refus = erreur.code as RefusLien;
    }
  }

  // `redirect` lève : il reste hors du `try`, sinon le `catch` l'avalerait.
  if (destination) redirect(destination);
  redirect(`/${langue}/acces-demande/${encodeURIComponent(jeton)}?refus=${refus}`);
}
