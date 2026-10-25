import type { FamilleCoordonnees, GenreDemande, StatutDemande } from "@teranga/contracts";

/**
 * Les règles de divulgation des coordonnées — adresse exacte, téléphone,
 * immatriculation — en un seul endroit, pour les deux dépôts.
 *
 * Les coordonnées sont saisies et vérifiées par l'équipe, réservation par
 * réservation. Aucune transition n'en fabrique : une demande peut être
 * confirmée sans elles. Les transitions ne font que les **retirer**.
 */

/** Les seuls statuts sous lesquels une lecture rend les coordonnées. */
export const STATUTS_AVEC_COORDONNEES: readonly StatutDemande[] = ["confirmee", "terminee"];

/**
 * Les statuts qui effacent les coordonnées en base.
 *
 * `envoyee` et `acceptee` n'en font pas partie : des coordonnées saisies par
 * l'équipe avant la confirmation y sont gardées — masquées à la lecture — pour
 * être révélées à la confirmation, pas effacées par elle.
 */
export const STATUTS_EFFACANT_COORDONNEES: readonly StatutDemande[] = ["annulee", "expiree", "refusee"];

/**
 * Le visiteur peut-il recevoir les coordonnées ?
 *
 * Deux conditions, toutes deux nécessaires : un statut qui les autorise, et
 * une vérification **enregistrée en base** par une seconde personne de
 * l'équipe. Des coordonnées seulement saisies ne sortent jamais.
 */
export function coordonneesDivulguables(statut: StatutDemande, verifiees: boolean): boolean {
  return verifiees && STATUTS_AVEC_COORDONNEES.includes(statut);
}

/**
 * Les statuts où l'équipe peut saisir, corriger ou vérifier : la réservation
 * est acceptée ou confirmée, et pas encore passée.
 *
 * `terminee` en est exclu : la prestation a eu lieu, ses coordonnées restent
 * lisibles par le visiteur si elles étaient vérifiées, mais ne se réécrivent
 * plus. `annulee`, `expiree` et `refusee` les ont effacées.
 */
export const STATUTS_SAISIE_COORDONNEES: readonly StatutDemande[] = ["acceptee", "confirmee"];

/**
 * La forme de coordonnées qu'appelle un genre de réservation.
 *
 * `undefined` pour un service à la demande : aucune forme n'est prévue, et en
 * inventer une serait décider à la place du produit.
 */
export function familleCoordonnees(genre: GenreDemande): FamilleCoordonnees | undefined {
  if (genre === "logement") return "logement";
  if (genre === "trajet" || genre === "location" || genre === "taxi") return "vehicule";
  return undefined;
}

export function coordonneesAEffacer(statut: StatutDemande): boolean {
  return STATUTS_EFFACANT_COORDONNEES.includes(statut);
}
