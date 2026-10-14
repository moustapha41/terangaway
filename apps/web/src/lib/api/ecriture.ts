/**
 * Domaines d'écriture branchés sur l'API Nest.
 *
 * Lecture (offres, recherche…) reste sur les mocks tant que la colonne
 * partenaire n'est pas livrée. Ici : comptes, demandes, réponses, visiteurs.
 */
import type { Demande, MotifRefus, ServiceALaDemande } from "@teranga/contracts";

import { appelerApi } from "./http";

export async function apiCreerDemandeLogement(corps: {
  logementId: string;
  debut: string;
  fin: string;
  personnes: number;
  heureArrivee?: string;
  message?: string;
  code?: string;
}): Promise<Demande> {
  return appelerApi<Demande>("/demandes/logement", { method: "POST", corps });
}

export async function apiCreerDemandeVehicule(corps: {
  vehiculeId: string;
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee?: string;
  quand: string;
  passagers: number;
  bagages: number;
  vol?: string;
  message?: string;
  code?: string;
}): Promise<Demande> {
  return appelerApi<Demande>("/demandes/vehicule", { method: "POST", corps });
}

export async function apiListerDemandes(visiteurId = "visiteur-demo"): Promise<Demande[]> {
  return appelerApi<Demande[]>("/visiteurs/moi/demandes", {
    headers: { "x-visiteur-id": visiteurId },
  });
}

export async function apiObtenirDemande(
  id: string,
  visiteurId = "visiteur-demo",
): Promise<Demande> {
  return appelerApi<Demande>(`/visiteurs/moi/demandes/${id}`, {
    headers: { "x-visiteur-id": visiteurId },
  });
}

export async function apiConfirmerDemande(
  id: string,
  visiteurId = "visiteur-demo",
): Promise<Demande> {
  return appelerApi<Demande>(`/visiteurs/moi/demandes/${id}/confirmer`, {
    method: "POST",
    headers: { "x-visiteur-id": visiteurId },
  });
}

export async function apiAnnulerDemande(
  id: string,
  visiteurId = "visiteur-demo",
): Promise<Demande> {
  return appelerApi<Demande>(`/visiteurs/moi/demandes/${id}/annuler`, {
    method: "POST",
    headers: { "x-visiteur-id": visiteurId },
  });
}

export async function apiOuvrirJeton(jeton: string) {
  return appelerApi<{
    etat: "valide" | "repondu" | "expire";
    reponse?: "acceptee" | "refusee" | "indisponible";
    demande?: {
      reference: string;
      genre: "logement" | "vehicule";
      titre: string;
      dates: { debut: string; fin: string };
      personnes: number;
      heureArrivee?: string;
      total: number;
      expireLe: string;
    };
  }>(`/reponses/${jeton}`);
}

export async function apiRepondreAvecJeton(
  jeton: string,
  reponse: "acceptee" | "refusee" | "indisponible",
  motif?: MotifRefus,
) {
  return appelerApi(`/reponses/${jeton}`, {
    method: "POST",
    corps: { reponse, motif },
  });
}

export async function apiVerifierOtp(telephone: string, code: string) {
  return appelerApi<{ visiteurId: string }>("/comptes/otp/verifier", {
    method: "POST",
    corps: { telephone, code },
  });
}

/**
 * Demande de service (V2).
 *
 * Le point d'entrée `POST /demandes/service` appartient au module `demandes`,
 * côté API. Tant qu'il n'existe pas, la couture reste sur son mock : le
 * parcours marche de bout en bout sans lui.
 */
export async function apiCreerDemandeService(corps: {
  service: ServiceALaDemande;
  details: Record<string, string>;
  message?: string;
  code?: string;
}): Promise<Demande> {
  return appelerApi<Demande>("/demandes/service", { method: "POST", corps });
}
