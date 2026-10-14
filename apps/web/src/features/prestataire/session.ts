import { cookies } from "next/headers";
import { COMPTE, type ComptePrestataire } from "@/mocks/fixtures/prestataire";
import { COOKIE_SESSION } from "./cookie";

/**
 * Session prestataire, simulée par un cookie.
 *
 * Le vrai mécanisme viendra de l'API : code à usage unique par SMS, puis jeton de
 * session. Ce qui compte ici et qui ne changera pas, c'est la forme — la session
 * se lit côté serveur, jamais côté client, pour qu'aucun écran ne puisse afficher
 * des données en se fiant à un état du navigateur.
 */
export async function prestataireConnecte(): Promise<ComptePrestataire | null> {
  const jar = await cookies();
  return jar.get(COOKIE_SESSION)?.value === COMPTE.id ? COMPTE : null;
}

export { COOKIE_SESSION };
