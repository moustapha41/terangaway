"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiDeconnexion, apiVerifierOtp } from "@/lib/api/ecriture";
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

export type EtatConnexionVisiteur = { erreur?: "code" | "identifiant" };

export async function seConnecter(
  _precedent: EtatConnexionVisiteur,
  formData: FormData,
): Promise<EtatConnexionVisiteur> {
  const identifiant = String(formData.get("identifiant") ?? "").trim();
  const code = String(formData.get("code") ?? "");
  const suite = String(formData.get("suite") ?? "/mes-demandes");

  if (identifiant.length < 6) return { erreur: "identifiant" };

  if (!apiMockActive()) {
    try {
      const res = await apiVerifierOtp(identifiant, code);
      await poser(res.token ?? res.visiteurId);
      redirect(`/fr${suite}`);
    } catch {
      return { erreur: "code" };
    }
  }

  if (code !== CODE_DE_DEMONSTRATION) return { erreur: "code" };

  await poser(identifiant);
  redirect(`/fr${suite}`);
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
