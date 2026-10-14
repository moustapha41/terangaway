import { cookies } from "next/headers";
import { COOKIE_VISITEUR } from "./cookie";

/**
 * Session visiteur.
 *
 * « Le compte arrive le plus tard possible : tout se consulte librement, le code
 * n'est demandé qu'à l'envoi d'une demande » (§B.1). La session n'existe donc
 * qu'à partir de l'envoi, et elle ne protège que deux écrans : le compte et le
 * suivi des demandes.
 */
export interface Visiteur {
  identifiant: string;
}

export async function visiteurConnecte(): Promise<Visiteur | null> {
  const jar = await cookies();
  const valeur = jar.get(COOKIE_VISITEUR)?.value;
  return valeur ? { identifiant: valeur } : null;
}
