/**
 * Jetons de réponse envoyés par SMS aux partenaires (PAR-11).
 *
 * Un jeton ouvre **une** demande, sans compte et sans mot de passe. Il est donc
 * à usage unique et daté : c'est tout ce qui protège l'accès. Un jeton déjà
 * utilisé ou périmé ne montre plus rien de la demande, seulement le numéro de
 * l'équipe (§B.8).
 */
export type EtatJeton = "valide" | "repondu" | "expire";

export interface Jeton {
  jeton: string;
  demandeId: string;
  etat: EtatJeton;
  /** Ce que le partenaire a répondu, s'il a déjà répondu. */
  reponse?: "acceptee" | "refusee" | "indisponible";
  expireLe: string;
}

const dans = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();

export const JETONS: Jeton[] = [
  { jeton: "demo-valide", demandeId: "d-002", etat: "valide", expireLe: dans(90) },
  { jeton: "demo-bientot", demandeId: "d-008", etat: "valide", expireLe: dans(12) },
  { jeton: "demo-repondu", demandeId: "d-001", etat: "repondu", reponse: "acceptee", expireLe: dans(-60) },
  { jeton: "demo-expire", demandeId: "d-005", etat: "expire", expireLe: dans(-240) },
];
