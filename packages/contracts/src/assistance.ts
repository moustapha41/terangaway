/**
 * Coordonnées de l'assistance — source unique, pour le site comme pour l'API.
 *
 * Elles étaient écrites à cinq endroits et avaient déjà divergé : la page Aide
 * annonçait 7 h – 23 h, les pages Services et À propos « 7j/7 », et la maquette
 * du centre d'aide « lundi-vendredi, 8 h – 20 h ». Un horaire d'assistance est
 * une promesse ; il ne doit exister qu'une fois.
 *
 * Le choix retenu est **tous les jours** : les Jeux se tiennent aussi le
 * week-end, et un visiteur bloqué un dimanche soir est précisément celui qui a
 * besoin d'appeler. La maquette est l'exception, pas la règle.
 *
 * Elles vivent dans les contrats depuis que les e-mails de l'API portent eux
 * aussi un lien WhatsApp : deux copies du numéro auraient fini par diverger, et
 * un visiteur aurait écrit à un numéro que plus personne ne lit.
 */
export const ASSISTANCE = {
  telephone: "+221 76 522 29 29",
  whatsapp: "221765222929",
  email: "contact@teranga-way.com",
} as const;

/** Le lien d'une conversation WhatsApp, avec un message déjà écrit s'il y en a un. */
export function lienWhatsapp(message?: string): string {
  const base = `https://wa.me/${ASSISTANCE.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
