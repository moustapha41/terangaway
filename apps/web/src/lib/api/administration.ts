/**
 * Le backoffice, côté site : lecture et traitement des demandes reçues.
 *
 * Ces appels ne passent pas par le cookie visiteur que `appelerApi` fait
 * suivre tout seul : l'équipe a sa propre session, dans son propre cookie, et
 * une personne peut très bien être connectée aux deux à la fois sur le même
 * navigateur. Le jeton est donc toujours passé explicitement.
 */
import type {
  CompteAdministrateur,
  ContactAdmin,
  CoordonneesAdmin,
  DemandeAdmin,
  FiltresDemandesAdmin,
  MiseAJourDemandeAdmin,
  PageDemandesAdmin,
  ResultatReceptionAcompte,
  SaisieCoordonneesAdmin,
  SaisieReceptionAcompte,
  TableauDeBordAdmin,
  VueAcompteAdmin,
} from "@teranga/contracts";

import { appelerApi } from "./http";

function entetes(jeton: string): Record<string, string> {
  return { authorization: `Bearer ${jeton}` };
}

export function parametresFiltres(filtres: FiltresDemandesAdmin): string {
  const params = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(filtres)) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    params.set(nom, String(valeur));
  }
  return params.toString();
}

/** Le compte d'équipe derrière le jeton. Lève 401 ou 403 si ce n'en est pas un. */
export function apiAdminMoi(jeton: string): Promise<CompteAdministrateur> {
  return appelerApi<CompteAdministrateur>("/administration/moi", { headers: entetes(jeton) });
}

export function apiAdminTableauDeBord(jeton: string): Promise<TableauDeBordAdmin> {
  return appelerApi<TableauDeBordAdmin>("/administration/tableau-de-bord", {
    headers: entetes(jeton),
  });
}

export function apiAdminDemandes(
  jeton: string,
  filtres: FiltresDemandesAdmin,
): Promise<PageDemandesAdmin> {
  const requete = parametresFiltres(filtres);
  return appelerApi<PageDemandesAdmin>(
    `/administration/demandes${requete ? `?${requete}` : ""}`,
    { headers: entetes(jeton) },
  );
}

export function apiAdminDemande(jeton: string, id: string): Promise<DemandeAdmin> {
  return appelerApi<DemandeAdmin>(`/administration/demandes/${encodeURIComponent(id)}`, {
    headers: entetes(jeton),
  });
}

/** Les comptes partenaires, pour le sélecteur d'assignation. */
export function apiAdminPrestataires(jeton: string): Promise<ContactAdmin[]> {
  return appelerApi<ContactAdmin[]>("/administration/prestataires", {
    headers: entetes(jeton),
  });
}

export function apiAdminTraiter(
  jeton: string,
  id: string,
  maj: MiseAJourDemandeAdmin,
): Promise<DemandeAdmin> {
  return appelerApi<DemandeAdmin>(`/administration/demandes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    corps: maj,
    headers: entetes(jeton),
  });
}

/**
 * Les coordonnées d'une réservation : la seule lecture qui les rend à l'équipe,
 * avec qui les a saisies et vérifiées. Jamais mises en cache (`no-store` côté
 * API comme côté `appelerApi`).
 */
export function apiAdminCoordonnees(jeton: string, id: string): Promise<CoordonneesAdmin> {
  return appelerApi<CoordonneesAdmin>(`/administration/demandes/${encodeURIComponent(id)}/coordonnees`, {
    headers: entetes(jeton),
  });
}

export function apiAdminSaisirCoordonnees(
  jeton: string,
  id: string,
  saisie: SaisieCoordonneesAdmin,
): Promise<CoordonneesAdmin> {
  return appelerApi<CoordonneesAdmin>(`/administration/demandes/${encodeURIComponent(id)}/coordonnees`, {
    method: "PUT",
    corps: saisie,
    headers: entetes(jeton),
  });
}

/** `saisieLe` : la version relue. Une saisie plus récente fait refuser la vérification. */
export function apiAdminVerifierCoordonnees(
  jeton: string,
  id: string,
  saisieLe: string,
): Promise<CoordonneesAdmin> {
  return appelerApi<CoordonneesAdmin>(
    `/administration/demandes/${encodeURIComponent(id)}/coordonnees/verification`,
    { method: "POST", corps: { saisieLe }, headers: entetes(jeton) },
  );
}

/* ─────────────────────────────── Acompte ─────────────────────────────── */

/**
 * L'acompte d'une demande, tel que l'API le calcule. Aucun montant n'est
 * recalculé ici : l'écran affiche ce que le serveur a décidé.
 */
const cheminAcompte = (id: string) => `/administration/demandes/${encodeURIComponent(id)}/acompte`;

export function apiAdminAcompte(jeton: string, id: string): Promise<VueAcompteAdmin> {
  return appelerApi<VueAcompteAdmin>(cheminAcompte(id), { headers: entetes(jeton) });
}

export function apiAdminPreparerAcompte(jeton: string, id: string) {
  return appelerApi<{ issue: { etat: string }; vue: VueAcompteAdmin }>(`${cheminAcompte(id)}/preparation`, {
    method: "POST",
    headers: entetes(jeton),
  });
}

export function apiAdminReceptionAcompte(jeton: string, id: string, saisie: SaisieReceptionAcompte) {
  return appelerApi<{ resultat: ResultatReceptionAcompte; vue: VueAcompteAdmin }>(`${cheminAcompte(id)}/reception`, {
    method: "POST",
    corps: saisie,
    headers: entetes(jeton),
  });
}

export function apiAdminRenvoyerInstructions(jeton: string, id: string) {
  return appelerApi<{ issue: string; vue: VueAcompteAdmin }>(`${cheminAcompte(id)}/instructions/renvoi`, {
    method: "POST",
    headers: entetes(jeton),
  });
}

export function apiAdminRenvoyerConfirmation(jeton: string, id: string) {
  return appelerApi<{ etat: string; vue: VueAcompteAdmin }>(`${cheminAcompte(id)}/reception/confirmation/renvoi`, {
    method: "POST",
    headers: entetes(jeton),
  });
}
