import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { estLangue } from "@/lib/i18n/langues";
import {
  COOKIE_OAUTH,
  DUREE_OAUTH_SECONDES,
  adresseDeRetour,
  configurationGoogle,
  urlAutorisation,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/**
 * Départ vers Google.
 *
 * Trois valeurs sont retenues le temps de l'aller-retour, dans un cookie
 * `httpOnly` de dix minutes :
 *
 * - `state`, comparé au retour — sans lui, n'importe qui pourrait provoquer
 *   une connexion depuis un autre site (CSRF) ;
 * - `nonce`, recopié dans l'`id_token` par Google et vérifié au retour, ce qui
 *   interdit de rejouer un jeton obtenu ailleurs ;
 * - `suite`, la page où la personne voulait aller, qu'on perdrait sinon.
 *
 * Le cookie plutôt qu'une session serveur : il n'y a rien à retenir au-delà de
 * ces dix minutes, et le site doit pouvoir tourner sur plusieurs instances sans
 * mémoire partagée.
 */
export async function GET(requete: Request) {
  const configuration = configurationGoogle();
  const url = new URL(requete.url);
  const langue = estLangue(url.searchParams.get("langue") ?? "") ? url.searchParams.get("langue")! : "fr";
  const suite = url.searchParams.get("suite") ?? "";

  // Non configuré : on renvoie à la connexion ordinaire plutôt que d'afficher
  // une erreur Google que le visiteur ne peut pas résoudre.
  if (!configuration) {
    return NextResponse.redirect(new URL(`/${langue}/connexion?erreur=google`, url.origin));
  }

  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");

  const reponse = NextResponse.redirect(
    urlAutorisation({
      clientId: configuration.clientId,
      redirection: adresseDeRetour(requete),
      state,
      nonce,
    }),
  );

  reponse.cookies.set(COOKIE_OAUTH, JSON.stringify({ state, nonce, suite, langue }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` et non `strict` : au retour de Google la navigation vient d'un
    // autre site, et un cookie `strict` ne serait pas envoyé — le `state`
    // serait introuvable et toute connexion échouerait.
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_OAUTH_SECONDES,
  });

  return reponse;
}
