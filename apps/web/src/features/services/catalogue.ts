import type { NomIcone } from "@teranga/ui";

export interface Service {
  cle: string;
  icone: NomIcone;
  /** Un espace à parcourir — catalogue d'offres ou carte —, ou une demande à décrire. */
  parcourir: boolean;
  href: string;
  image?: string;
  /** Cadrage de la photo dans la vignette, quand le centre coupe mal. */
  position?: string;
}

/**
 * Les services de la plateforme.
 *
 * Tous se parcourent désormais : les catalogues logement et transport, et les
 * pages qui expliquent avant de proposer un formulaire — guides, restauration,
 * assistance, internet. Ces quatre-là restent des **services à la demande**
 * (V2) : aucun prestataire n'y est référencé, et c'est l'équipe qui cherche. Le
 * visiteur décrit son besoin, l'équipe cherche et renvoie une proposition
 * chiffrée qu'il confirme ou non.
 *
 * Seuls les services dont nous avons une photo en portent une. Internet garde
 * son aplat et son icône : la seule image dont nous disposons tient en 195 px
 * de large, nette dans la page, mais étirée en vignette elle serait floue.
 */
export const SERVICES: Service[] = [
  { cle: "logement", icone: "logement", parcourir: true, href: "/logements", image: "/images/service-logement.png" },
  { cle: "transport", icone: "voiture", parcourir: true, href: "/transports", image: "/images/service-transport.png" },
  { cle: "guides", icone: "guide", parcourir: true, href: "/services/guides", image: "/images/services/hero-guide.jpg" },
  { cle: "restauration", icone: "restauration", parcourir: true, href: "/services/restauration", image: "/images/services/hero-restauration.jpg" },
  { cle: "assistance", icone: "assistance", parcourir: true, href: "/services/assistance", image: "/images/services/hero-assistance.jpg", position: "object-top" },
  { cle: "internet", icone: "wifi", parcourir: true, href: "/services/internet" },
];
