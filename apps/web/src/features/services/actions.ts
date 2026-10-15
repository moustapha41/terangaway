"use server";

import { revalidatePath } from "next/cache";
import type { Demande } from "@teranga/contracts";
import { envoyerDemandeService, type EntreeDemandeService, CodeInvalide } from "@/mocks/api";
import { ouvrirSession } from "@/features/compte/actions";

export type ResultatDemandeService =
  | { succes: true; demande: Demande }
  | {
      succes: false;
      erreur: "code_invalide" | "validation" | "serveur";
      raison?: "faux" | "expire";
      message?: string;
    };

/**
 * Server Action exécutée sur le serveur Next.js pour créer une demande de service.
 * Dialogue avec l'API NestJS interne (`http://api:3101`) ou le mock sans appel direct du navigateur.
 */
export async function creerDemandeServiceAction(
  entree: EntreeDemandeService,
  contact?: { email?: string; telephone?: string },
): Promise<ResultatDemandeService> {
  // Validation côté serveur
  if (!entree.service || typeof entree.service !== "string") {
    return { succes: false, erreur: "validation", message: "Type de service requis." };
  }
  if (!entree.details || typeof entree.details !== "object") {
    return { succes: false, erreur: "validation", message: "Détails du service requis." };
  }

  try {
    const demande = await envoyerDemandeService({
      service: entree.service,
      details: entree.details,
      message: entree.message ? entree.message.slice(0, 2000).trim() : undefined,
      code: entree.code ? entree.code.trim() : undefined,
    });

    // Ouvre la session visiteur directement sur le serveur
    const identifiantSession = contact?.email?.trim() || contact?.telephone?.trim() || demande.reference;
    await ouvrirSession(identifiantSession);

    revalidatePath("/[locale]/mes-demandes", "page");
    revalidatePath("/[locale]/compte", "page");

    return { succes: true, demande };
  } catch (erreur) {
    if (erreur instanceof CodeInvalide) {
      return { succes: false, erreur: "code_invalide", raison: erreur.raison };
    }
    return {
      succes: false,
      erreur: "serveur",
      message: erreur instanceof Error ? erreur.message : "Erreur inattendue",
    };
  }
}
