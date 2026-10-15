"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiDeconnexion, apiEnvoyerOtp, apiVerifierOtp } from "@/lib/api/ecriture";
import { apiMockActive } from "@/lib/api/http";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { COOKIE_VISITEUR } from "./cookie";

const HUIT_HEURES = 60 * 60 * 8;

async function poser(identifiant: string) {
  const jar = await cookies();
  jar.set(COOKIE_VISITEUR, identifiant, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HUIT_HEURES,
  });
}

/**
 * Ouvre la session après l'envoi d'une demande.
 *
 * Le visiteur vient de saisir son code : lui redemander de se connecter pour
 * suivre la demande qu'il vient d'envoyer serait absurde.
 */
export async function ouvrirSession(identifiant: string) {
  await poser(identifiant);
}

export type ResultatDemandeOtp =
  | { succes: true; expireLe: string; delaiAttenteSecondes: number }
  | { succes: false; erreur: string };

/**
 * Envoie un code de vérification OTP par e-mail ou SMS.
 */
export async function demanderCodeOtpAction(
  identifiant: string,
): Promise<ResultatDemandeOtp> {
  const propre = identifiant.trim();
  if (propre.length < 5) {
    return { succes: false, erreur: "Identifiant invalide (adresse e-mail requise)." };
  }

  if (!propre.includes("@")) {
    return {
      succes: false,
      erreur: "L'envoi de codes par SMS n'est pas disponible actuellement. Veuillez saisir votre adresse e-mail pour vous connecter.",
    };
  }

  if (!apiMockActive()) {
    try {
      const res = await apiEnvoyerOtp(propre);
      return {
        succes: true,
        expireLe: res.expireLe,
        delaiAttenteSecondes: res.delaiAttenteSecondes ?? 60,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impossible d'envoyer le code de vérification.";
      return { succes: false, erreur: msg };
    }
  }

  return {
    succes: true,
    expireLe: new Date(Date.now() + 10 * 60_000).toISOString(),
    delaiAttenteSecondes: 60,
  };
}

export type EtatConnexionVisiteur = { erreur?: "code" | "identifiant" | "envoi"; message?: string };

/**
 * Résout et sécurise la destination après connexion :
 * - Empêche les attaques par redirection ouverte (open redirect).
 * - Préserve ou ajoute le préfixe de langue sans duplication.
 */
function resoudreDestination(suite: string): string {
  const propre = suite.trim();
  const cible = propre.startsWith("/") && !propre.startsWith("//") ? propre : "/mes-demandes";
  if (cible.startsWith("/fr") || cible.startsWith("/en") || cible.startsWith("/es")) {
    return cible;
  }
  return `/fr${cible}`;
}

export async function seConnecter(
  _precedent: EtatConnexionVisiteur,
  formData: FormData,
): Promise<EtatConnexionVisiteur> {
  const identifiant = String(formData.get("identifiant") ?? "").trim();
  const code = String(formData.get("code") ?? "");
  const suite = String(formData.get("suite") ?? "/mes-demandes");

  if (identifiant.length < 6) return { erreur: "identifiant" };

  const destination = resoudreDestination(suite);

  if (!apiMockActive()) {
    try {
      const res = await apiVerifierOtp(identifiant, code);
      await poser(res.token ?? res.visiteurId);
    } catch (err) {
      if (
        (err instanceof Error && err.message === "NEXT_REDIRECT") ||
        (typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT"))
      ) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : undefined;
      return { erreur: "code", message: msg };
    }

    redirect(destination);
  }

  if (code !== CODE_DE_DEMONSTRATION) return { erreur: "code" };

  await poser(identifiant);
  redirect(destination);
}

export async function seDeconnecter() {
  const jar = await cookies();
  const token = jar.get(COOKIE_VISITEUR)?.value;
  if (!apiMockActive() && token) {
    await apiDeconnexion(token).catch(() => {});
  }
  jar.delete(COOKIE_VISITEUR);
  redirect("/fr");
}
