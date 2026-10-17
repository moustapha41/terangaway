"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiDeconnexion, apiEnvoyerOtp, apiVerifierOtp } from "@/lib/api/ecriture";
import { apiMockActive } from "@/lib/api/http";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { COOKIE_VISITEUR, DUREE_SESSION_SECONDES, estJetonSessionValide } from "./cookie";
import { resoudreDestination } from "./destination";

async function poser(jeton: string) {
  const jar = await cookies();
  jar.set(COOKIE_VISITEUR, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_SECONDES,
  });
}

/**
 * Ouvre ou met à jour la session avec un vrai jeton de session.
 *
 * Rejette les adresses e-mail et les valeurs non valides, pour ne jamais
 * écraser un jeton cryptographique existant par une donnée publique.
 *
 * Renvoie `false` quand elle refuse : l'appelant doit le savoir. Dans la
 * version déployée, cette fonction échouait en silence, et le visiteur se
 * retrouvait déconnecté juste après avoir saisi un code correct, sans qu'aucune
 * trace n'explique pourquoi.
 */
export async function ouvrirSession(jeton: string): Promise<boolean> {
  if (!estJetonSessionValide(jeton)) {
    console.error(
      "[compte] jeton de session refusé : ni e-mail, ni valeur publique, ni chaîne courte ne peut ouvrir une session.",
    );
    return false;
  }
  await poser(jeton);
  return true;
}

/**
 * Ouvre la session à partir de la réponse de `POST /comptes/otp/verifier`.
 *
 * `visiteurId` est un identifiant de compte : il circule dans les URL et les
 * journaux, et l'API ne résout plus de session à partir de lui. Retomber dessus
 * posait un cookie que l'API refusait ensuite systématiquement — le visiteur
 * paraissait déconnecté juste après un code correct. On exige donc le jeton,
 * et on échoue bruyamment s'il manque.
 */
export async function ouvrirSessionVerifiee(verification: {
  visiteurId: string;
  token?: string;
}): Promise<boolean> {
  const jeton = verification.token?.trim();
  if (!jeton) {
    console.error(
      "[compte] /comptes/otp/verifier n'a pas renvoyé de jeton de session : " +
        "aucune session ouverte (un identifiant de compte n'est pas un jeton).",
    );
    return false;
  }
  return ouvrirSession(jeton);
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
      const ouverte = await ouvrirSessionVerifiee(res);
      if (!ouverte) {
        return {
          erreur: "envoi",
          message:
            "Votre code est correct, mais la session n'a pas pu être ouverte. Veuillez réessayer dans un instant.",
        };
      }
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

  const jetonMock = `session-mock-${Buffer.from(identifiant).toString("hex")}`;
  await poser(jetonMock);
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

export async function obtenirVisiteurConnecteNom(): Promise<string | null> {
  const { visiteurConnecte } = await import("./session");
  const vis = await visiteurConnecte();
  if (!vis) return null;
  const base = vis.identifiant.includes("@") ? vis.identifiant.split("@")[0] : vis.identifiant;
  return base
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

