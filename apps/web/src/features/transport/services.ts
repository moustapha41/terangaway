import { CalendarDays, Car, Plane, type LucideIcon } from "lucide-react";

export interface ServiceTransport {
  /**
   * Préfixe des clés de catalogue — `transport.services.<cle>Titre`, `…Alt` —
   * et nom de l'onglet de recherche que la carte ouvre, déjà réglé.
   */
  cle: "transfert" | "chauffeur" | "location";
  image: string;
  /** Point d'ancrage du recadrage : les cartes sont en portrait, les photos non. */
  position: string;
  icone: LucideIcon;
}

/**
 * Les trois services de transport, déclarés **une seule fois**.
 *
 * Les photos vivaient auparavant dans le composant qui les affiche, et deux
 * services partageaient la même : on ne voyait pas ce qu'on achetait. Les
 * garder ici, à côté des clés de traduction et de l'onglet de recherche
 * correspondant, évite qu'un écran montre une image et un autre une seconde
 * pour le même service.
 *
 * Chaque photo est recadrée sur son sujet, qui n'est jamais au centre : le
 * chauffeur est à droite de son pare-brise, le car à gauche de l'aérogare.
 */
export const SERVICES_TRANSPORT: readonly ServiceTransport[] = [
  {
    cle: "transfert",
    image: "/images/transport/transfert-aeroport.jpg",
    position: "object-[center_55%]",
    icone: Plane,
  },
  {
    cle: "chauffeur",
    image: "/images/transport/chauffeur-prive.jpg",
    position: "object-[72%_center]",
    icone: Car,
  },
  {
    cle: "location",
    image: "/images/transport/location-chauffeur.jpg",
    position: "object-[70%_center]",
    icone: CalendarDays,
  },
];
