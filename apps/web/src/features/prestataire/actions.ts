"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CodeInvalide,
  connexionPrestataire,
  deposerOffre,
  deposerVehicule,
  enregistrerDisponibilites,
  enregistrerTarifs,
  envoyerEnValidation,
  repondreDemandeRecue,
} from "@/mocks/api";
import { COMPTE } from "@/mocks/fixtures/prestataire";
import { COOKIE_SESSION } from "./cookie";

export type EtatConnexion = { erreur?: "code" | "telephone" };

export async function seConnecter(
  _precedent: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  const telephone = String(formData.get("telephone") ?? "");
  const code = String(formData.get("code") ?? "");

  try {
    const ok = await connexionPrestataire(telephone, code);
    if (!ok) return { erreur: "telephone" };
  } catch (erreur) {
    if (erreur instanceof CodeInvalide) return { erreur: "code" };
    throw erreur;
  }

  const jar = await cookies();
  jar.set(COOKIE_SESSION, COMPTE.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/fr/prestataire");
}

export async function seDeconnecter() {
  const jar = await cookies();
  jar.delete(COOKIE_SESSION);
  redirect("/fr/prestataire/connexion");
}

export async function enregistrerOffre(formData: FormData) {
  const nombre = (cle: string) => Number(formData.get(cle) ?? 0);

  const offre = await deposerOffre({
    type: String(formData.get("type") ?? "appartement"),
    titre: String(formData.get("titre") ?? ""),
    ville: String(formData.get("ville") ?? ""),
    quartier: String(formData.get("quartier") ?? ""),
    capacite: nombre("capacite"),
    chambres: nombre("chambres"),
    prixParNuit: nombre("prixParNuit"),
    description: String(formData.get("description") ?? ""),
    conditionsAnnulation: String(formData.get("conditionsAnnulation") ?? ""),
  });

  revalidatePath("/[locale]/prestataire/offres", "page");
  // Le dépôt crée un brouillon : on enchaîne sur les photos, qui sont ce qui
  // manque toujours et ce qui retarde le plus la mise en ligne.
  redirect(`/fr/prestataire/offres/${offre.id}/photos?creee=1`);
}

export async function repondre(formData: FormData) {
  const id = String(formData.get("id"));
  const reponse = String(formData.get("reponse")) as "acceptee" | "refusee";
  await repondreDemandeRecue(id, reponse);
  revalidatePath("/[locale]/prestataire/demandes", "page");
  revalidatePath("/[locale]/prestataire/demandes/[id]", "page");
}

export async function sauverDisponibilites(formData: FormData) {
  const id = String(formData.get("id"));
  const periodes = String(formData.get("periodes") ?? "")
    .split("|")
    .filter(Boolean)
    .map((brut) => {
      const [debut, fin] = brut.split("~");
      return { debut, fin };
    });

  await enregistrerDisponibilites(id, periodes);
  revalidatePath(`/[locale]/prestataire/offres/[id]/disponibilites`, "page");
  revalidatePath("/[locale]/prestataire/offres", "page");
}

export async function sauverTarifs(formData: FormData) {
  const id = String(formData.get("id"));
  const libelles = formData.getAll("fraisLibelle").map(String);
  const montants = formData.getAll("fraisMontant").map((m) => Number(m));

  await enregistrerTarifs(id, {
    prixParNuit: Number(formData.get("prixParNuit") ?? 0),
    sejourMinimum: formData.get("sejourMinimum") ? Number(formData.get("sejourMinimum")) : undefined,
    fraisFixes: libelles
      .map((libelle, i) => ({ libelle, montant: montants[i] ?? 0 }))
      .filter((frais) => frais.libelle.trim() && frais.montant > 0),
  });

  revalidatePath(`/[locale]/prestataire/offres/[id]/tarifs`, "page");
  revalidatePath("/[locale]/prestataire/offres", "page");
}

export async function envoyerOffre(formData: FormData) {
  const id = String(formData.get("id"));
  const resultat = await envoyerEnValidation(id);

  revalidatePath("/[locale]/prestataire/offres", "page");
  if (resultat.ok) redirect("/fr/prestataire/offres?envoye=1");
  redirect(`/fr/prestataire/offres/${id}/photos?manque=${resultat.manquant.join(",")}`);
}

export async function enregistrerVehicule(formData: FormData) {
  const nombre = (cle: string) => Number(formData.get(cle) ?? 0);
  const offres = formData.getAll("offres").map(String);

  await deposerVehicule({
    categorie: String(formData.get("categorie") ?? "berline"),
    marque: String(formData.get("marque") ?? ""),
    modele: String(formData.get("modele") ?? ""),
    annee: nombre("annee"),
    placesPassagers: nombre("placesPassagers"),
    bagages: nombre("bagages"),
    climatisation: formData.get("climatisation") === "oui",
    zonesCouvertes: String(formData.get("zones") ?? "")
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean),
    offresProposees: offres,
    prixParTrajet: nombre("prixParTrajet") || undefined,
    prixParJour: nombre("prixParJour") || undefined,
  });

  revalidatePath("/[locale]/prestataire/offres", "page");
  redirect("/fr/prestataire/offres?depose=1");
}
