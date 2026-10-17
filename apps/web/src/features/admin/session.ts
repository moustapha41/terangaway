import { cookies } from "next/headers";
import type { CompteAdministrateur } from "@teranga/contracts";
import { apiAdminMoi } from "@/lib/api/administration";
import { COOKIE_ADMIN } from "./cookie";

/**
 * Le compte d'équipe de la session en cours, ou `null`.
 *
 * La décision est prise par l'API, à chaque chargement de page : le cookie ne
 * prouve rien par lui-même, et le rôle peut avoir été retiré depuis la
 * connexion. Un backoffice qui se fierait à son propre cookie resterait ouvert
 * à quelqu'un qu'on vient d'en sortir.
 */
export async function administrateurConnecte(): Promise<CompteAdministrateur | null> {
  const jeton = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!jeton) return null;

  try {
    return await apiAdminMoi(jeton);
  } catch {
    // 401, 403 ou API injoignable : dans les trois cas, pas de backoffice.
    return null;
  }
}

/** Le jeton brut, pour les appels qui suivent dans la même page. */
export async function jetonAdmin(): Promise<string | null> {
  return (await cookies()).get(COOKIE_ADMIN)?.value ?? null;
}

export { COOKIE_ADMIN };
