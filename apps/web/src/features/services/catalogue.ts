import type { NomIcone } from "@teranga/ui";

export interface Service {
  cle: string;
  icone: NomIcone;
  /** Un espace à parcourir — catalogue d'offres ou carte —, ou une demande à décrire. */
  parcourir: boolean;
  href: string;
  image?: string;
}

/**
 * Les services de la plateforme.
 *
 * Trois se parcourent : les deux catalogues, logement et transport, et la
 * carte des points de repère. Les autres sont des **services à la demande**
 * (V2) : aucun prestataire n'y est référencé, donc rien à parcourir. Le
 * visiteur décrit son besoin, l'équipe cherche et renvoie une proposition
 * chiffrée qu'il confirme ou non.
 *
 * Seuls les catalogues portent une photo : montrer une belle image de
 * restaurant pour un service qu'on ne peut pas encore présenter promettrait
 * ce qu'on ne tient pas.
 */
export const SERVICES: Service[] = [
  { cle: "logement", icone: "logement", parcourir: true, href: "/logements", image: "/images/service-logement.png" },
  { cle: "transport", icone: "voiture", parcourir: true, href: "/transports", image: "/images/service-transport.png" },
  { cle: "guides", icone: "guide", parcourir: false, href: "/services/guides" },
  { cle: "restauration", icone: "restauration", parcourir: false, href: "/services/restauration" },
  { cle: "assistance", icone: "assistance", parcourir: false, href: "/services/assistance" },
  { cle: "repere", icone: "repere", parcourir: true, href: "/services/repere" },
  { cle: "decouverte", icone: "globe", parcourir: false, href: "/services/decouverte" },
  { cle: "internet", icone: "wifi", parcourir: false, href: "/services/internet" },
];
