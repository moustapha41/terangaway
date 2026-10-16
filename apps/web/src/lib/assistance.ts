/**
 * Coordonnées de l'assistance — source unique.
 *
 * Elles étaient écrites à cinq endroits et avaient déjà divergé : la page Aide
 * annonçait 7 h – 23 h, les pages Services et À propos « 7j/7 », et la maquette
 * du centre d'aide « lundi-vendredi, 8 h – 20 h ». Un horaire d'assistance est
 * une promesse ; il ne doit exister qu'une fois.
 *
 * Le choix retenu est **tous les jours** : les Jeux se tiennent aussi le
 * week-end, et un visiteur bloqué un dimanche soir est précisément celui qui a
 * besoin d'appeler. La maquette est l'exception, pas la règle.
 */
export const ASSISTANCE = {
  telephone: "+221 76 522 29 29",
  whatsapp: "221765222929",
  email: "contact@teranga-way.com",
} as const;

/** Numéro de téléphone prêt pour un lien `tel:`. */
export const telUrl = `tel:${ASSISTANCE.telephone.replace(/\s/g, "")}`;
export const whatsappUrl = `https://wa.me/${ASSISTANCE.whatsapp}`;
export const emailUrl = `mailto:${ASSISTANCE.email}`;
