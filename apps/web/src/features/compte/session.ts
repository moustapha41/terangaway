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
    const brut = await apiObtenirSession(jeton);
    const profil = (brut as { visiteur?: typeof brut })?.visiteur ?? brut;
    // `compteId` est la preuve que la session existe : l'API lève 401 sinon.
    if (!profil?.compteId) {
      return null;
    }
    return {
      identifiant: profil.email,
      compteId: profil.compteId,
      email: profil.email,
      telephone: profil.telephone,
      token: profil.token ?? jeton!,
    };
  } catch {
    return null;
  }
});

export { nomLisible } from "./cookie";
