"use server";

import { revalidatePath } from "next/cache";
import type { Demande } from "@teranga/contracts";
import type { DemandeEnvoyee } from "@/lib/api/ecriture";
import { envoyerDemandeService, type EntreeDemandeService } from "@/mocks/api";
import { visiteurConnecte } from "@/features/compte/session";
import {
  coordonneesDemande,
  ouvrirSessionDemo,
  type Coordonnees,
} from "@/features/demande/coordonnees";

export type ResultatDemandeService =
  | { succes: true; demande: DemandeEnvoyee }
  | {
      succes: false;
      erreur: "validation" | "serveur";
      message?: string;
    };

/**
 * Server Action exécutée sur le serveur Next.js pour créer une demande de service.
 * Dialogue avec l'API NestJS interne (`http://api:3101`) ou le mock sans appel direct du navigateur.
 */
export async function creerDemandeServiceAction(
  entree: EntreeDemandeService,
  contact?: Coordonnees,
): Promise<ResultatDemandeService> {
  // Validation côté serveur
  if (!entree.service || typeof entree.service !== "string") {
    return { succes: false, erreur: "validation", message: "Type de service requis." };
  }
  if (!entree.details || typeof entree.details !== "object") {
    return { succes: false, erreur: "validation", message: "Détails du service requis." };
  }

  // Comme pour un logement : une session, ou les coordonnées saisies. Le code à
  // six chiffres n'est plus demandé à l'envoi.
  const sessionActive = await visiteurConnecte();
  const envoyeur = coordonneesDemande(contact);

  if (!sessionActive && !envoyeur) {
    return { succes: false, erreur: "validation", message: "Adresse e-mail requise." };
  }

  try {
    const demande = await envoyerDemandeService({
      service: entree.service,
      details: entree.details,
      message: entree.message ? entree.message.slice(0, 2000).trim() : undefined,
      contact: envoyeur,
    });

    if (!sessionActive) await ouvrirSessionDemo(envoyeur?.email);

    revalidatePath("/[locale]/mes-demandes", "page");
    revalidatePath("/[locale]/compte", "page");

    return { succes: true, demande };
  } catch (erreur) {
    return {
      succes: false,
      erreur: "serveur",
      message: erreur instanceof Error ? erreur.message : "Erreur inattendue",
    };
  }
}
