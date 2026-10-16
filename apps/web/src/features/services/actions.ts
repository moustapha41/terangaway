"use server";

import { revalidatePath } from "next/cache";
import type { Demande } from "@teranga/contracts";
import { envoyerDemandeService, type EntreeDemandeService, CodeInvalide, CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { ouvrirSession } from "@/features/compte/actions";
import { visiteurConnecte } from "@/features/compte/session";
import { verifierCodeEtOuvrirSession } from "@/features/compte/verification-otp";
import { apiMockActive } from "@/lib/api/http";

export type ResultatDemandeService =
  | { succes: true; demande: Demande }
  | {
      succes: false;
      erreur:
        | "code_invalide"
        | "trop_de_tentatives"
        | "session"
        | "validation"
        | "serveur";
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

  // Vérifier si une session visiteur valide existe déjà
  const sessionActive = await visiteurConnecte();

  if (!sessionActive) {
    const codeOtp = entree.code?.trim();
    if (!codeOtp && !apiMockActive()) {
      return { succes: false, erreur: "code_invalide", raison: "faux" };
    }

    if (codeOtp) {
      if (!apiMockActive()) {
        const email = contact?.email?.trim();
        if (!email) {
          return { succes: false, erreur: "validation", message: "Adresse e-mail requise pour valider le code." };
        }
        const verification = await verifierCodeEtOuvrirSession(email, codeOtp);
        if (!verification.ok) {
          return { succes: false, ...verification.echec };
        }
      } else {
        if (codeOtp !== CODE_DE_DEMONSTRATION) {
          return { succes: false, erreur: "code_invalide", raison: "faux" };
        }
        const email = contact?.email?.trim() || "visiteur@teranga-way.com";
        const mockToken = `session-mock-${Buffer.from(email).toString("hex")}`;
        await ouvrirSession(mockToken);
      }
    }
  }

  try {
    const demande = await envoyerDemandeService({
      service: entree.service,
      details: entree.details,
      message: entree.message ? entree.message.slice(0, 2000).trim() : undefined,
    });

    if (!sessionActive && apiMockActive()) {
      const email = contact?.email?.trim() || "visiteur@teranga-way.com";
      const mockToken = `session-mock-${Buffer.from(email).toString("hex")}`;
      await ouvrirSession(mockToken);
    }

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
