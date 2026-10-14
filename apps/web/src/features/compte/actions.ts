"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { COOKIE_VISITEUR } from "./cookie";

const HUIT_HEURES = 60 * 60 * 8;

async function poser(identifiant: string) {
  const jar = await cookies();
  jar.set(COOKIE_VISITEUR, identifiant, {
    httpOnly: true,
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
  if (code !== CODE_DE_DEMONSTRATION) return { erreur: "code" };

  await poser(identifiant);
  redirect(`/fr${suite}`);
}

export async function seDeconnecter() {
  const jar = await cookies();
  jar.delete(COOKIE_VISITEUR);
  redirect("/fr");
}
