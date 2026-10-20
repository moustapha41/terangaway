import { ouvrirSession } from "@/features/compte/actions";
import { apiMockActive } from "@/lib/api/http";

/**
 * Qui envoie une demande, quand il n'y a pas de compte.
 *
 * Il n'y a plus de code à saisir pour envoyer une demande : le visiteur a
 * choisi son offre et rempli ses informations, sa demande part. L'adresse
 * rattache la demande et donne à l'équipe de quoi rappeler — elle ne vaut pas
 * identité, et n'ouvre donc aucune session côté API. Lire ses demandes passe
 * toujours par une vraie connexion.
 *
 * Ce module n'est pas un fichier d'actions : les trois tunnels — logement,
 * transport, service — y puisent la même règle, et une action serveur ne peut
 * exporter que des fonctions asynchrones.
 */
export interface Coordonnees {
  email?: string;
  nom?: string;
  telephone?: string;
}

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ce qui part à l'API : une adresse plausible, ou rien du tout. */
export function coordonneesDemande(contact?: Coordonnees) {
  const email = contact?.email?.trim().toLowerCase();
  if (!email || !ADRESSE.test(email)) return undefined;
  return {
    email,
    nom: contact?.nom?.trim() || undefined,
    telephone: contact?.telephone?.trim() || undefined,
  };
}

/**
 * La session de démonstration, pour que le mode mock garde un espace client.
 *
 * Sans API derrière, il n'y a pas de compte à retrouver : ce jeton porte
 * l'adresse saisie et sert au seul suivi local des demandes. En production,
 * rien ne s'ouvre à l'envoi — le suivi passe par une connexion, et l'écran de
 * confirmation ne propose « voir ma demande » qu'à qui en a une.
 */
export async function ouvrirSessionDemo(email?: string): Promise<void> {
  if (!apiMockActive()) return;
  const adresse = email?.trim() || "visiteur@teranga-way.com";
  await ouvrirSession(`session-mock-${Buffer.from(adresse).toString("hex")}`);
}
