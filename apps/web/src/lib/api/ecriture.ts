/**
 * Domaines d'écriture branchés sur l'API Nest.
 *
 * Lecture (offres, recherche…) reste sur les mocks tant que la colonne
 * partenaire n'est pas livrée. Ici : comptes, demandes, réponses, visiteurs.
 */
import type { Demande, MotifRefus, ServiceALaDemande } from "@teranga/contracts";

import { appelerApi, appelerApiEnveloppe, type NotificationApi } from "./http";

/**
 * Les coordonnées qui accompagnent une demande envoyée sans compte.
 *
 * Il n'y a plus de code à saisir à l'envoi : l'adresse rattache la demande et
 * donne à l'équipe de quoi rappeler, sans valoir identité pour autant — aucune
 * session ne s'ouvre avec elle.
 */
export interface ContactDemande {
  email: string;
  nom?: string;
  telephone?: string;
}

export async function apiCreerDemandeLogement(corps: {
  logementId: string;
  debut: string;
  fin: string;
  personnes: number;
  heureArrivee?: string;
  message?: string;
  contact?: ContactDemande;
}): Promise<DemandeEnvoyee> {
  const { donnees, notification } = await appelerApiEnveloppe<Demande>("/demandes/logement", {
    method: "POST",
    corps,
  });
  return avecNotification(donnees, notification);
}

/**
 * Une demande qu'on vient d'enregistrer, et ce qu'on sait de son e-mail.
 * `acompteAnnonce` n'est vrai que si l'e-mail annonce réellement un acompte.
 */
export type DemandeEnvoyee = Demande & { emailEnvoye: boolean; acompteAnnonce: boolean };

/**
 * Absent = on ne sait pas, donc on ne prétend rien : l'écran traite cela comme
 * un e-mail non parti et un paiement non annoncé.
 */
function avecNotification(demande: Demande, notification?: NotificationApi): DemandeEnvoyee {
  return {
    ...demande,
    emailEnvoye: notification?.emailEnvoye === true,
    acompteAnnonce: notification?.acompteAnnonce === true,
  };
}

/**
 * Échange le lien reçu par e-mail contre une session visiteur.
 * Le jeton part dans le corps de la requête, jamais dans une URL de l'API.
 */
export async function apiOuvrirLienDemande(jeton: string) {
  return appelerApi<{ visiteurId: string; token: string; demandeId: string }>(
    "/comptes/lien-demande/ouvrir",
    { method: "POST", corps: { jeton } },
  );
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
  contact?: ContactDemande;
}): Promise<DemandeEnvoyee> {
  const { donnees, notification } = await appelerApiEnveloppe<Demande>("/demandes/vehicule", {
    method: "POST",
    corps,
  });
  return avecNotification(donnees, notification);
}

export async function apiListerDemandes(visiteurId?: string): Promise<Demande[]> {
  const headers: Record<string, string> = {};
  if (visiteurId) headers["x-visiteur-id"] = visiteurId;
  return appelerApi<Demande[]>("/visiteurs/moi/demandes", { headers });
}

export async function apiObtenirDemande(
  id: string,
  visiteurId?: string,
): Promise<Demande> {
  const headers: Record<string, string> = {};
  if (visiteurId) headers["x-visiteur-id"] = visiteurId;
  return appelerApi<Demande>(`/visiteurs/moi/demandes/${id}`, { headers });
}

export async function apiConfirmerDemande(
  id: string,
  visiteurId?: string,
): Promise<Demande> {
  const headers: Record<string, string> = {};
  if (visiteurId) headers["x-visiteur-id"] = visiteurId;
  return appelerApi<Demande>(`/visiteurs/moi/demandes/${id}/confirmer`, {
    method: "POST",
    headers,
  });
}

export async function apiAnnulerDemande(
  id: string,
  visiteurId?: string,
): Promise<Demande> {
  const headers: Record<string, string> = {};
  if (visiteurId) headers["x-visiteur-id"] = visiteurId;
  return appelerApi<Demande>(`/visiteurs/moi/demandes/${id}/annuler`, {
    method: "POST",
    headers,
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

export async function apiEnvoyerOtp(identifiant: string) {
  return appelerApi<{
    expireLe: string;
    delaiAttenteSecondes: number;
    /** Présent uniquement quand l'API a ouvert le mode démonstration. */
    codeDemo?: string;
  }>("/comptes/otp/envoyer", {
    method: "POST",
    corps: { identifiant },
  });
}

export async function apiVerifierOtp(identifiant: string, code: string) {
  return appelerApi<{ visiteurId: string; token?: string }>("/comptes/otp/verifier", {
    method: "POST",
    corps: { identifiant, code },
  });
}

/* ─────────────────────────────── Inscription ────────────────────────────── */

/**
 * Le compte, tel que l'API le décrit après une inscription ou une connexion.
 *
 * Volontairement maigre : aucune empreinte, aucun jeton d'une autre session.
 * `aUnMotDePasse` sert à savoir si ce compte peut se connecter par mot de passe
 * ou s'il relève encore du parcours par code.
 */
export interface CompteApi {
  id: string;
  email?: string | null;
  nom?: string | null;
  estVerifie: boolean;
  aUnMotDePasse: boolean;
}

/**
 * Ouvre une inscription en attente : le compte est créé non vérifié et un code
 * part vers l'adresse. **Aucune session n'est ouverte à cette étape.**
 */
export async function apiInscrire(corps: {
  nom: string;
  email: string;
  motDePasse: string;
}) {
  return appelerApi<{ email: string; expireLe: string; delaiAttenteSecondes: number }>(
    "/comptes/inscription",
    { method: "POST", corps },
  );
}

/** Vérifie le code d'inscription, active le compte et ouvre la session. */
export async function apiVerifierInscription(email: string, code: string) {
  return appelerApi<{ visiteurId: string; token?: string; compte: CompteApi }>(
    "/comptes/inscription/verifier",
    { method: "POST", corps: { email, code } },
  );
}

/** Renvoie le code d'inscription, sous la limitation de débit de l'API. */
export async function apiRenvoyerCodeInscription(email: string) {
  return appelerApi<{ expireLe: string; delaiAttenteSecondes: number }>(
    "/comptes/inscription/renvoyer",
    { method: "POST", corps: { email } },
  );
}

/** Connecte un compte existant par adresse e-mail et mot de passe. */
export async function apiConnexionMotDePasse(email: string, motDePasse: string) {
  return appelerApi<{ visiteurId: string; token?: string; compte: CompteApi }>(
    "/comptes/connexion",
    { method: "POST", corps: { email, motDePasse } },
  );
}

export async function apiConnexionPrestataire(telephone: string, code: string) {
  return appelerApi<{ prestataireId: string; token?: string }>("/comptes/prestataire/connexion", {
    method: "POST",
    corps: { telephone, code },
  });
}

export async function apiObtenirSession(token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-visiteur-id"] = token;
  }
  // Forme à plat, celle que `GET /comptes/session` renvoie réellement :
  // `{ donnees: { compteId, email, telephone, token } }`, et `appelerApi`
  // déballe déjà `donnees`. Le type annonçait une clé `visiteur` qui n'existe
  // dans aucune route de l'API — `res.visiteur` valait donc toujours
  // `undefined`, et toute page protégée renvoyait à la connexion.
  return appelerApi<{
    compteId: string;
    email: string;
    telephone?: string | null;
    token?: string;
  }>("/comptes/session", { headers });
}

export async function apiDeconnexion(token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["x-visiteur-id"] = token;
    headers["Authorization"] = `Bearer ${token}`;
  }
  return appelerApi<{ deconnecte: boolean }>("/comptes/deconnexion", {
    method: "POST",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
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
  contact?: ContactDemande;
}): Promise<DemandeEnvoyee> {
  const { donnees, notification } = await appelerApiEnveloppe<Demande>("/demandes/service", {
    method: "POST",
    corps,
  });
  return avecNotification(donnees, notification);
}
