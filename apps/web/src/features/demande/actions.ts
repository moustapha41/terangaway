"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Demande, Logement } from "@teranga/contracts";
import {
  annulerDemande,
  confirmerDemande,
  envoyerDemande,
  envoyerDemandeTransport,
  DelaiTropCourt,
  LogementPris,
  type EntreeDemande,
  type EntreeDemandeTransport,
  type EtatEnvoi,
} from "@/mocks/api";
import {
  effacerBrouillon,
  poserBrouillon,
  type BrouillonDemande,
} from "@/features/demande/brouillon";
import { visiteurConnecte } from "@/features/compte/session";
import { poserRecapitulatif, recapitulatifDe } from "@/features/demande/recapitulatif";
import {
  coordonneesDemande,
  ouvrirSessionDemo,
  type Coordonnees,
} from "@/features/demande/coordonnees";
import { resoudreDestination } from "@/features/compte/destination";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import type { DemandeEnvoyee } from "@/lib/api/ecriture";

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
      erreur: "logement_pris" | "validation" | "serveur";
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
  contact?: Coordonnees,
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

  // Une session ouverte rattache la demande au compte ; sinon, les coordonnées
  // saisies suffisent, et c'est là tout le changement : plus de code à l'envoi.
  const sessionActive = await visiteurConnecte();
  const envoyeur = coordonneesDemande(contact);

  if (!sessionActive && !envoyeur) {
    return { succes: false, erreur: "validation", message: "Adresse e-mail requise." };
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
        contact: envoyeur,
      },
      etatSimule,
    );

    if (!sessionActive) await ouvrirSessionDemo(envoyeur?.email);

    // Le récapitulatif de la confirmation vient de la réponse de l'API. S'il ne
    // peut pas être posé, la demande n'en reste pas moins enregistrée.
    await poserRecapitulatif(recapitulatifDe(demande, demande.emailEnvoye, demande.acompteAnnonce)).catch(() => {});

    revalidatePath("/[locale]/mes-demandes", "page");
    revalidatePath("/[locale]/compte", "page");

    return { succes: true, demande };
  } catch (erreur) {
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
  | { succes: true; demande: DemandeEnvoyee }
  | {
      succes: false;
      erreur: "delai_trop_court" | "validation" | "serveur";
      message?: string;
    };

/**
 * Server Action exécutée sur le serveur Next.js pour créer une demande de transport.
 * Transmet l'appel à l'API interne (`http://api:3101`) ou au mock sans appel direct du navigateur.
 */
export async function creerDemandeTransportAction(
  entree: EntreeDemandeTransport,
  etatSimule: EtatEnvoi = "normal",
  contact?: Coordonnees,
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

  const sessionActive = await visiteurConnecte();
  const envoyeur = coordonneesDemande(contact);

  if (!sessionActive && !envoyeur) {
    return { succes: false, erreur: "validation", message: "Adresse e-mail requise." };
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
        contact: envoyeur,
      },
      etatSimule,
    );

    if (!sessionActive) await ouvrirSessionDemo(envoyeur?.email);

    revalidatePath("/[locale]/mes-demandes", "page");
    revalidatePath("/[locale]/compte", "page");

    return { succes: true, demande };
  } catch (erreur) {
    // Le formulaire sait dire « moins de deux heures » (§B.3), mais rien ne le
    // lui disait : l'issue existait côté écran, pas côté action.
    if (erreur instanceof DelaiTropCourt) {
      return { succes: false, erreur: "delai_trop_court", message: erreur.message };
    }
    return {
      succes: false,
      erreur: "serveur",
      message: erreur instanceof Error ? erreur.message : "Erreur inattendue",
    };
  }
}

/* ──────────────── Mise de côté d'une demande, le temps de s'inscrire ─────── */

/**
 * Met la saisie de côté et envoie vers l'inscription.
 *
 * Appelée quand quelqu'un préfère créer un compte plutôt que de saisir un code
 * dans la feuille basse. Le parcours sort de la page : sans ce brouillon, le
 * visiteur reviendrait sur un formulaire vide après avoir choisi ses dates et
 * écrit son message.
 *
 * `suite` est la page où revenir — relue et bornée par `resoudreDestination`
 * avant toute redirection, jamais utilisée telle quelle.
 */
export async function mettreDemandeDeCoteEtSInscrire(
  brouillon: BrouillonDemande,
  suite: string,
  langue = "fr",
): Promise<void> {
  await poserBrouillon(brouillon);

  const cible: Langue = estLangue(langue) ? langue : "fr";
  const destination = resoudreDestination(suite, cible);
  // `suite` repart en paramètre : la vérification s'en servira pour ramener
  // ici, et `resoudreDestination` la revalidera à ce moment-là.
  redirect(`/${cible}/inscription?suite=${encodeURIComponent(destination)}`);
}

/** La demande est partie : le brouillon n'a plus de raison d'être. */
export async function oublierBrouillonAction(): Promise<void> {
  await effacerBrouillon();
}
