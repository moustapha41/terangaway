import type {
  FiltresDemandesAdmin,
  GenreDemande,
  ServiceALaDemande,
  StatutDemande,
} from "@teranga/contracts";
import {
  GENRES_DEMANDE,
  SERVICES_A_LA_DEMANDE,
  STATUTS_DEMANDE,
} from "@teranga/contracts";

/**
 * La requête, ramenée aux filtres que le dépôt connaît.
 *
 * Une valeur inconnue est ignorée plutôt que refusée : un filtre obsolète
 * dans une URL partagée par courriel doit rendre une liste, pas une erreur.
 */
export function lireFiltres(
  requete: Record<string, string | undefined>,
): FiltresDemandesAdmin {
  const dans = <T extends string>(liste: readonly T[], valeur?: string): T | undefined =>
    valeur && (liste as readonly string[]).includes(valeur) ? (valeur as T) : undefined;

  const entier = (valeur?: string): number | undefined => {
    const n = Number(valeur);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  const jour = (valeur?: string): string | undefined =>
    valeur && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : undefined;

  return {
    statut: dans<StatutDemande>(STATUTS_DEMANDE, requete.statut),
    genre: dans<GenreDemande>(GENRES_DEMANDE, requete.genre),
    service: dans<ServiceALaDemande>(SERVICES_A_LA_DEMANDE, requete.service),
    recherche: requete.recherche?.trim().slice(0, 120) || undefined,
    du: jour(requete.du),
    au: jour(requete.au),
    page: entier(requete.page),
    parPage: entier(requete.parPage),
  };
}
