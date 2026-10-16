import { cache } from "react";
import { cookies } from "next/headers";
import { apiObtenirSession } from "@/lib/api/ecriture";
import { apiMockActive } from "@/lib/api/http";
import { COOKIE_VISITEUR, estJetonSessionValide } from "./cookie";

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
  compteId: string;
  email: string;
  telephone?: string | null;
  token: string;
}

export const visiteurConnecte = cache(async (): Promise<Visiteur | null> => {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_VISITEUR)?.value;

  if (!estJetonSessionValide(jeton)) {
    return null;
  }

  if (apiMockActive()) {
    let email = "visiteur@teranga-way.com";
    if (jeton!.startsWith("session-mock-")) {
      try {
        email = Buffer.from(jeton!.slice("session-mock-".length), "hex").toString("utf-8");
      } catch {
        email = jeton!;
      }
    }
    return {
      identifiant: email,
      compteId: "visiteur-mock",
      email,
      token: jeton!,
    };
  }

  try {
    const res = await apiObtenirSession(jeton);
    if (!res?.visiteur) {
      return null;
    }
    return {
      identifiant: res.visiteur.email,
      compteId: res.visiteur.compteId,
      email: res.visiteur.email,
      telephone: res.visiteur.telephone,
      token: res.visiteur.token ?? jeton!,
    };
  } catch {
    return null;
  }
});

export { nomLisible } from "./cookie";
