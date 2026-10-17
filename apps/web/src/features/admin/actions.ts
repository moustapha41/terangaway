"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { MiseAJourDemandeAdmin } from "@teranga/contracts";
import { apiAdminMoi, apiAdminTraiter } from "@/lib/api/administration";
import { apiEnvoyerOtp, apiVerifierOtp } from "@/lib/api/ecriture";
import { ErreurApi } from "@/lib/api/http";
import { COOKIE_ADMIN, DUREE_SESSION_ADMIN_SECONDES } from "./cookie";

export type ResultatConnexionAdmin =
  | { succes: true }
  | { succes: false; erreur: "code" | "role" | "serveur"; message?: string };

/**
 * Envoie un code à l'adresse de la personne.
 *
 * La réponse ne dit jamais si l'adresse est connue, ni si elle appartient à
 * l'équipe : énumérer les comptes d'administration depuis l'écran de connexion
 * est exactement ce qu'on cherche à éviter. Le tri se fait après le code.
 */
export async function envoyerCodeAdminAction(email: string): Promise<{ envoye: boolean }> {
  const adresse = email.trim().toLowerCase();
  if (!adresse.includes("@")) return { envoye: false };

  try {
    await apiEnvoyerOtp(adresse);
  } catch {
    // Même réponse qu'en cas de succès : l'écran ne doit rien révéler.
  }
  return { envoye: true };
}

/**
 * Vérifie le code, puis le rôle, puis seulement pose le cookie.
 *
 * L'ordre importe : une session visiteur est ouverte par l'API dès que le code
 * est bon, mais tant que `/administration/moi` n'a pas répondu, rien n'entre
 * dans le cookie du backoffice. Un visiteur ordinaire qui connaît l'URL
 * repart donc avec un refus, pas avec une demi-session.
 */
export async function connexionAdminAction(
  email: string,
  code: string,
): Promise<ResultatConnexionAdmin> {
  const adresse = email.trim().toLowerCase();
  const saisie = code.trim();
  if (!adresse || !saisie) return { succes: false, erreur: "code" };

  let jeton: string | undefined;
  try {
    const verification = await apiVerifierOtp(adresse, saisie);
    jeton = verification.token?.trim();
  } catch (erreur) {
    if (erreur instanceof ErreurApi) return { succes: false, erreur: "code", message: erreur.message };
    return { succes: false, erreur: "serveur" };
  }
  if (!jeton) return { succes: false, erreur: "serveur" };

  try {
    await apiAdminMoi(jeton);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 403) {
      return { succes: false, erreur: "role" };
    }
    return { succes: false, erreur: "serveur" };
  }

  const jar = await cookies();
  jar.set(COOKIE_ADMIN, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_ADMIN_SECONDES,
  });

  return { succes: true };
}

export async function deconnexionAdminAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_ADMIN);
}

export type ResultatTraitement =
  | { succes: true }
  | { succes: false; message: string };

/**
 * Enregistre ce que l'équipe a changé sur une demande.
 *
 * L'API refuse les transitions interdites par la table des statuts : le
 * message qu'elle renvoie est remonté tel quel, parce qu'il dit précisément ce
 * qui n'était pas permis — « passage de confirmée à acceptée interdit » vaut
 * mieux qu'un « échec » générique devant lequel on reste sans rien faire.
 */
export async function traiterDemandeAction(
  id: string,
  maj: MiseAJourDemandeAdmin,
): Promise<ResultatTraitement> {
  const jeton = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!jeton) return { succes: false, message: "Session expirée." };

  try {
    await apiAdminTraiter(jeton, id, maj);
  } catch (erreur) {
    if (erreur instanceof ErreurApi) return { succes: false, message: erreur.message };
    return { succes: false, message: "Le serveur n'a pas répondu." };
  }

  revalidatePath(`/admin/demandes/${id}`);
  revalidatePath("/admin/demandes");
  revalidatePath("/admin");
  return { succes: true };
}
