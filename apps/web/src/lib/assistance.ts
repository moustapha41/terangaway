import { ASSISTANCE, lienWhatsapp } from "@teranga/contracts";

/**
 * Coordonnées de l'assistance : elles vivent dans les contrats, parce que les
 * e-mails de l'API portent eux aussi le lien WhatsApp. Relayées ici pour que le
 * site garde son point d'entrée habituel.
 */
export { ASSISTANCE, lienWhatsapp };

/** Numéro de téléphone prêt pour un lien `tel:`. */
export const telUrl = `tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`;
export const whatsappUrl = `https://wa.me/${ASSISTANCE.whatsapp}`;
export const emailUrl = `mailto:${ASSISTANCE.email}`;
