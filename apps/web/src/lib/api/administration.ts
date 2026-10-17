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
  DemandeAdmin,
  FiltresDemandesAdmin,
  MiseAJourDemandeAdmin,
  PageDemandesAdmin,
  TableauDeBordAdmin,
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
