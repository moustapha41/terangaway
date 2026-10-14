"use server";

import { revalidatePath } from "next/cache";
import type { MotifRefus } from "@teranga/contracts";
import { repondreAvecJeton } from "@/mocks/api";

/**
 * La réponse du partenaire passe par un `<form>` et une action serveur.
 *
 * Ce choix n'est pas de confort : le partenaire ouvre ce lien depuis un SMS, sur
 * le téléphone qu'il a, parfois en 2G. La page doit répondre sans que la moindre
 * ligne de JavaScript s'exécute chez lui.
 */
export async function repondre(formData: FormData) {
  const jeton = String(formData.get("jeton"));
  const reponse = String(formData.get("reponse")) as "acceptee" | "refusee" | "indisponible";
  const motif = formData.get("motif");

  await repondreAvecJeton(jeton, reponse, motif ? (String(motif) as MotifRefus) : undefined);
  revalidatePath(`/reponse/${jeton}`);
}
