import { NextResponse } from "next/server";
import { appelerApi, ErreurApi } from "@/lib/api/http";
import { COOKIE_VISITEUR, DUREE_SESSION_SECONDES, estJetonSessionValide } from "@/features/compte/cookie";
import { resoudreDestination } from "@/features/compte/destination";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import {
  COOKIE_OAUTH,
  adresseDeRetour,
  configurationGoogle,
  echangerCode,
  originePublique,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

interface Aller {
  state: string;
  nonce: string;
  suite: string;
  langue: Langue;
}

/**
 * Retour de Google.
 *
 * Le chemin est volontairement avare : à la première anomalie, on repart vers
 * la connexion ordinaire avec un motif, sans jamais ouvrir de session. Une
 * authentification qui « rattrape » un cas douteux est une authentification
 * qu'on peut tromper.
 *
 * La session elle-même n'est pas fabriquée ici. Le site ne sait pas signer un
 * jeton de session : c'est l'API qui tient les comptes et les sessions en base.
 * Ce point d'entrée lui transmet une adresse **vérifiée par Google** et reçoit
 * un jeton en retour.
 */
export async function GET(requete: Request) {
  const url = new URL(requete.url);
  // L'origine publique, jamais `url.origin` : voir `originePublique`.
  const origine = originePublique(requete);
  const aller = lireAller(requete);
  const langue = aller?.langue ?? "fr";
  const versConnexion = (motif: string) =>
    oublierAller(
      NextResponse.redirect(new URL(`/${langue}/connexion?erreur=${motif}`, origine)),
    );

  const configuration = configurationGoogle();
  if (!configuration || !aller) return versConnexion("google");

  // Google signale lui-même un refus : la personne a cliqué « Annuler ».
  if (url.searchParams.get("error")) return versConnexion("google-annule");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== aller.state) return versConnexion("google");

  let identite;
  try {
    identite = await echangerCode({
      code,
      redirection: adresseDeRetour(requete),
      nonce: aller.nonce,
      configuration,
    });
  } catch (erreur) {
    console.error("[google] échange du code refusé", erreur);
    return versConnexion("google");
  }

  // Une adresse non confirmée chez Google ne prouve rien : n'importe qui peut
  // déclarer une adresse qu'il ne détient pas.
  if (!identite.emailVerifie) return versConnexion("google-non-verifie");

  let jeton: string;
  try {
    // Le secret partagé, quand il est posé des deux côtés. Cette route de l'API
    // croit l'adresse qu'on lui donne : le réseau interne de la pile est sa
    // première barrière, cet en-tête la seconde.
    const secret = process.env.SECRET_OAUTH_INTERNE?.trim();
    const session = await appelerApi<{ token?: string; visiteurId?: string }>(
      "/comptes/oauth/google",
      {
        method: "POST",
        corps: { email: identite.email, nom: identite.nom, sub: identite.sub },
        headers: secret ? { "x-oauth-interne": secret } : undefined,
      },
    );
    jeton = session.token ?? session.visiteurId ?? "";
  } catch (erreur) {
    // 404 : le point d'entrée n'existe pas encore côté API. Le distinguer d'une
    // panne évite de faire chercher une erreur là où il n'y a qu'un chantier.
    const absent = erreur instanceof ErreurApi && erreur.statut === 404;
    console.error(absent ? "[google] /comptes/oauth/google absent de l'API" : "[google] API en échec", erreur);
    return versConnexion(absent ? "google-indisponible" : "google");
  }

  if (!estJetonSessionValide(jeton)) {
    console.error("[google] l'API n'a pas renvoyé de jeton de session exploitable");
    return versConnexion("google");
  }

  const reponse = oublierAller(
    NextResponse.redirect(new URL(resoudreDestination(aller.suite, langue), origine)),
  );
  reponse.cookies.set(COOKIE_VISITEUR, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_SECONDES,
  });
  return reponse;
}

function lireAller(requete: Request): Aller | null {
  const brut = requete.headers
    .get("cookie")
    ?.split(";")
    .map((morceau) => morceau.trim())
    .find((morceau) => morceau.startsWith(`${COOKIE_OAUTH}=`))
    ?.slice(COOKIE_OAUTH.length + 1);
  if (!brut) return null;

  try {
    const lu = JSON.parse(decodeURIComponent(brut)) as Partial<Aller>;
    if (!lu.state || !lu.nonce) return null;
    return {
      state: lu.state,
      nonce: lu.nonce,
      suite: typeof lu.suite === "string" ? lu.suite : "",
      langue: estLangue(lu.langue ?? "") ? (lu.langue as Langue) : "fr",
    };
  } catch {
    return null;
  }
}

/** Le cookie d'aller a fait son office : il ne doit pas survivre à l'échange. */
function oublierAller(reponse: NextResponse): NextResponse {
  reponse.cookies.set(COOKIE_OAUTH, "", { path: "/", maxAge: 0 });
  return reponse;
}
