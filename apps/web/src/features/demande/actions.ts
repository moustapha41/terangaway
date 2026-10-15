"use server";

import { revalidatePath } from "next/cache";
import type { Demande, Logement } from "@teranga/contracts";
import {
  annulerDemande,
  confirmerDemande,
  envoyerDemande,
  envoyerDemandeTransport,
  CodeInvalide,
  LogementPris,
  type EntreeDemande,
  type EntreeDemandeTransport,
  type EtatEnvoi,
} from "@/mocks/api";
import { ouvrirSession } from "@/features/compte/actions";

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

/* ──────────────────── Création de demande de logement ──────────────────── */

export type ResultatDemandeLogement =
  | { succes: true; demande: Demande }
  | {
      succes: false;
      erreur: "code_invalide" | "logement_pris" | "validation" | "serveur";
      raison?: "faux" | "expire";
      alternatives?: Logement[];
      message?: string;
    };

/**
 * Server Action exécutée sur le serveur Next.js pour créer une demande de logement.
 * Dialogue avec l'API NestJS interne (`http://api:3101`) ou le mock sans appel direct du navigateur.
 */
export async function creerDemandeLogementAction(
  entree: EntreeDemande,
  etatSimule: EtatEnvoi = "normal",
  contact?: { email?: string; telephone?: string },
): Promise<ResultatDemandeLogement> {
  // Validation stricte des données côté serveur
  if (!entree.logementId || typeof entree.logementId !== "string") {
    return { succes: false, erreur: "validation", message: "Identifiant de logement requis." };
  }
  if (!entree.debut || !entree.fin || new Date(entree.debut).getTime() > new Date(entree.fin).getTime()) {
    return { succes: false, erreur: "validation", message: "Dates de séjour invalides." };
  }
  const personnes = Number(entree.personnes);
  if (!Number.isInteger(personnes) || personnes < 1 || personnes > 50) {
    return { succes: false, erreur: "validation", message: "Nombre de personnes invalide." };
  }

  try {
    const demande = await envoyerDemande(
      {
        logementId: entree.logementId.trim(),
        debut: entree.debut,
        fin: entree.fin,
        personnes,
        heureArrivee: entree.heureArrivee?.trim(),
        message: entree.message ? entree.message.slice(0, 2000).trim() : undefined,
        code: entree.code ? entree.code.trim() : undefined,
      },
      etatSimule,
    );

    // Ouvre la session visiteur directement sur le serveur via le cookie sécurisé
    const identifiantSession = contact?.email?.trim() || contact?.telephone?.trim() || demande.reference;
    await ouvrirSession(identifiantSession);

    revalidatePath("/[locale]/mes-demandes", "page");
    revalidatePath("/[locale]/compte", "page");

    return { succes: true, demande };
  } catch (erreur) {
    if (erreur instanceof CodeInvalide) {
      return { succes: false, erreur: "code_invalide", raison: erreur.raison };
    }
    if (erreur instanceof LogementPris) {
      return { succes: false, erreur: "logement_pris", alternatives: erreur.alternatives };
    }
    return {
      succes: false,
      erreur: "serveur",
      message: erreur instanceof Error ? erreur.message : "Erreur inattendue",
    };
  }
}

/* ──────────────────── Création de demande de transport ──────────────────── */

export type ResultatDemandeTransport =
  | { succes: true; demande: Demande }
  | {
      succes: false;
      erreur: "code_invalide" | "delai_trop_court" | "validation" | "serveur";
      raison?: "faux" | "expire";
      message?: string;
    };

/**
 * Server Action exécutée sur le serveur Next.js pour créer une demande de transport.
 * Transmet l'appel à l'API interne (`http://api:3101`) ou au mock sans appel direct du navigateur.
 */
export async function creerDemandeTransportAction(
  entree: EntreeDemandeTransport,
  etatSimule: EtatEnvoi = "normal",
  contact?: { email?: string; telephone?: string },
): Promise<ResultatDemandeTransport> {
  // Validation stricte des données côté serveur
  if (!entree.vehiculeId || typeof entree.vehiculeId !== "string") {
    return { succes: false, erreur: "validation", message: "Véhicule requis." };
  }
  if (!["trajet", "journee", "taxi"].includes(entree.prestation)) {
    return { succes: false, erreur: "validation", message: "Prestation de transport invalide." };
  }
  if (!entree.depart || typeof entree.depart !== "string" || entree.depart.trim().length === 0) {
    return { succes: false, erreur: "validation", message: "Lieu de départ requis." };
  }
  const passagers = Number(entree.passagers);
  if (!Number.isInteger(passagers) || passagers < 1 || passagers > 50) {
    return { succes: false, erreur: "validation", message: "Nombre de passagers invalide." };
  }

  try {
    const demande = await envoyerDemandeTransport(
      {
        vehiculeId: entree.vehiculeId.trim(),
        prestation: entree.prestation,
        depart: entree.depart.trim(),
        arrivee: entree.arrivee?.trim() || undefined,
        quand: entree.quand,
        passagers,
        bagages: entree.bagages ? Math.max(0, Number(entree.bagages)) : 0,
        vol: entree.vol?.trim() || undefined,
        message: entree.message ? entree.message.slice(0, 2000).trim() : undefined,
        code: entree.code ? entree.code.trim() : undefined,
      },
      etatSimule,
    );

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
