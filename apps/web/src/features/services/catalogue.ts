import type { NomIcone } from "@teranga/ui";

export interface Service {
  cle: string;
  icone: NomIcone;
  /** Un catalogue à parcourir, ou une demande à décrire. */
  catalogue: boolean;
  href: string;
  image?: string;
}

/**
 * Les six services de la plateforme.
 *
 * Deux ont un catalogue : on y choisit une offre. Les quatre autres sont des
 * **services à la demande** (V2) : aucun prestataire n'y est référencé, donc
 * rien à parcourir. Le visiteur décrit son besoin, l'équipe cherche et renvoie
 * une proposition chiffrée qu'il confirme ou non.
 *
 * Seuls les services à catalogue portent une photo : montrer une belle image
 * de restaurant pour un service qu'on ne peut pas encore présenter promettrait
 * ce qu'on ne tient pas.
 */
export const SERVICES: Service[] = [
  { cle: "logement", icone: "logement", catalogue: true, href: "/logements", image: "/images/service-logement.png" },
  { cle: "transport", icone: "voiture", catalogue: true, href: "/transports", image: "/images/service-transport.png" },
  { cle: "restauration", icone: "restauration", catalogue: false, href: "/services/restauration" },
  { cle: "visites", icone: "visite", catalogue: false, href: "/services/visites" },
  { cle: "guides", icone: "guide", catalogue: false, href: "/services/guides" },
  { cle: "evenements", icone: "evenement", catalogue: false, href: "/services/evenements" },
];
