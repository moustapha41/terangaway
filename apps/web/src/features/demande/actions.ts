"use server";

import { revalidatePath } from "next/cache";
import { annulerDemande, confirmerDemande } from "@/mocks/api";

/**
 * Actions serveur de l'écran 6.
 *
 * Elles passent par un `<form>` : la confirmation d'une demande ne doit pas
 * dépendre de l'exécution de JavaScript dans le navigateur du visiteur.
 */
export async function confirmer(formData: FormData) {
  const id = String(formData.get("id"));
  await confirmerDemande(id);
  revalidatePath("/[locale]/mes-demandes/[id]", "page");
  revalidatePath("/[locale]/mes-demandes", "page");
}

export async function annuler(formData: FormData) {
  const id = String(formData.get("id"));
  await annulerDemande(id);
  revalidatePath("/[locale]/mes-demandes/[id]", "page");
  revalidatePath("/[locale]/mes-demandes", "page");
}
