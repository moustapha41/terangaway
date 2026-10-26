"use server";

import type { ChoixTransfert } from "@teranga/contracts";
import { apiChoisirTransfert } from "@/lib/api/ecriture";
import { apiMockActive } from "@/lib/api/http";
import { lireRecapitulatif, poserRecapitulatif } from "./recapitulatif";

/**
 * Ce que l'écran apprend de la réponse du visiteur.
 *
 * `emailEnvoye` n'est vrai que si l'e-mail de confirmation est réellement parti :
 * c'est lui qui décide de la phrase affichée — « un e-mail de confirmation vous
 * sera envoyé » ou « notre équipe vous contactera ». L'écran ne dit jamais la
 * première quand elle est fausse.
 *
 * `indisponible` : le cookie de confirmation a expiré ou manque. Le visiteur n'y
 * peut rien, et l'écran le lui dit sans l'accuser de rien.
 */
export type ResultatChoixTransfert =
  | { succes: true; transfert: ChoixTransfert; emailEnvoye: boolean }
  | { succes: false; erreur: "indisponible" | "serveur" };

/**
 * Enregistre la réponse à « voulez-vous qu'on vienne vous chercher à l'aéroport ? ».
 *
 * Le jeton qui l'autorise vit dans le cookie de confirmation, `httpOnly` : cette
 * action le lit et le présente à l'API, et le navigateur ne le voit jamais.
 * Sans lui — cookie expiré, autre appareil — rien n'est tenté.
 */
export async function choisirTransfertAction(choix: ChoixTransfert): Promise<ResultatChoixTransfert> {
  if (choix !== "souhaite" && choix !== "refuse") return { succes: false, erreur: "serveur" };

  const recap = await lireRecapitulatif();
  if (!recap?.jetonSuite) return { succes: false, erreur: "indisponible" };

  // La démonstration ne parle à aucune API et n'envoie aucun e-mail : elle ne le
  // prétend pas.
  if (apiMockActive()) {
    await poserRecapitulatif({ ...recap, transfert: choix, transfertEmailEnvoye: false }).catch(() => {});
    return { succes: true, transfert: choix, emailEnvoye: false };
  }

  try {
    const reponse = await apiChoisirTransfert(recap.id, { choix, jeton: recap.jetonSuite });

    // Un « oui » renvoyé tel quel n'écrit pas deux fois à l'API, qui répond alors
    // `emailEnvoye: false` : l'e-mail déjà parti reste, lui, parti.
    const dejaConfirme = recap.transfert === "souhaite" && recap.transfertEmailEnvoye === true;
    const emailEnvoye = choix === "souhaite" && (reponse.emailEnvoye || dejaConfirme);

    await poserRecapitulatif({
      ...recap,
      transfert: reponse.transfert,
      transfertEmailEnvoye: emailEnvoye,
    }).catch(() => {});

    return { succes: true, transfert: reponse.transfert, emailEnvoye };
  } catch (erreur) {
    console.error("[transfert] réponse non enregistrée", erreur);
    return { succes: false, erreur: "serveur" };
  }
}
