/**
 * Domaines de lecture branchés sur l'API Nest.
 *
 * Pendant est `ecriture.ts` : même client, mêmes contrats. Ici le catalogue —
 * ce que le visiteur consulte avant d'agir.
 */
import type { Avis, Logement, ResultatsLogements, Vehicule } from "@teranga/contracts";

import { appelerApi } from "./http";

/** Les critères deviennent une requête ; les listes partent en valeurs séparées par des virgules. */
function enParametres(criteres: Record<string, unknown>, page?: number): string {
  const params = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(criteres)) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    if (Array.isArray(valeur)) {
      if (valeur.length > 0) params.set(nom, valeur.join(","));
      continue;
    }
    params.set(nom, String(valeur));
  }
  // `debut` et `fin` ne filtrent rien tant que les disponibilités n'existent
  // pas côté serveur : on ne les envoie pas, plutôt que d'envoyer du bruit.
  params.delete("debut");
  params.delete("fin");
  if (page && page > 1) params.set("page", String(page));
  return params.toString();
}

export async function apiChercherLogements(
  criteres: Record<string, unknown>,
  page?: number,
): Promise<ResultatsLogements> {
  const requete = enParametres(criteres, page);
  return appelerApi<ResultatsLogements>(`/logements${requete ? `?${requete}` : ""}`);
}

export async function apiObtenirLogement(slug: string): Promise<Logement> {
  return appelerApi<Logement>(`/logements/${encodeURIComponent(slug)}`);
}

export async function apiChercherVehicules(
  besoin: "trajet" | "location" | "taxi",
  criteres: Record<string, unknown>,
): Promise<Vehicule[]> {
  const params = new URLSearchParams({ besoin });
  for (const [nom, valeur] of Object.entries(criteres)) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    params.set(nom, Array.isArray(valeur) ? valeur.join(",") : String(valeur));
  }
  return appelerApi<Vehicule[]>(`/vehicules?${params.toString()}`);
}

export async function apiObtenirVehicule(slug: string): Promise<Vehicule> {
  return appelerApi<Vehicule>(`/vehicules/${encodeURIComponent(slug)}`);
}

export async function apiEstimerTaxi(
  passagers: number,
): Promise<{ bas: number; haut: number }> {
  return appelerApi(`/vehicules/estimation-taxi?passagers=${passagers}`);
}

export interface FacettesVehicules {
  total: number;
  service: Record<string, number>;
  categorie: Record<string, number>;
  places: Record<string, number>;
  prix: { min: number; max: number };
}

export async function apiFacettesVehicules(
  besoin: "trajet" | "location" | "taxi",
  criteres: Record<string, unknown>,
): Promise<FacettesVehicules> {
  const params = new URLSearchParams({ besoin });
  for (const [nom, valeur] of Object.entries(criteres)) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    params.set(nom, Array.isArray(valeur) ? valeur.join(",") : String(valeur));
  }
  return appelerApi<FacettesVehicules>(`/vehicules/facettes?${params.toString()}`);
}

export async function apiLogementParId(id: string): Promise<Logement> {
  return appelerApi<Logement>(`/logements/par-id/${encodeURIComponent(id)}`);
}

export async function apiVehiculeParId(id: string): Promise<Vehicule> {
  return appelerApi<Vehicule>(`/vehicules/par-id/${encodeURIComponent(id)}`);
}

export async function apiAvisLogement(slug: string): Promise<Avis[]> {
  return appelerApi<Avis[]>(`/logements/${encodeURIComponent(slug)}/avis`);
}

export interface Lieu {
  valeur: string;
  detail: string;
}

export async function apiLieux(): Promise<Lieu[]> {
  return appelerApi<Lieu[]>("/lieux");
}

export async function apiVilles(): Promise<string[]> {
  return appelerApi<string[]>("/lieux/villes");
}
