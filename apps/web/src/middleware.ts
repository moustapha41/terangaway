import { NextResponse, type NextRequest } from "next/server";
import { detecterLangue, estLangue } from "@/lib/i18n/langues";
import { COOKIE_SESSION } from "@/features/prestataire/cookie";
import { COOKIE_VISITEUR } from "@/features/compte/cookie";

/**
 * Détection de la langue (§B.2, étape 1) et préfixe d'URL.
 *
 * Deux espaces restent hors langue, volontairement :
 *   /reponse/[jeton]  la page partenaire ouverte depuis un SMS, sans compte (PAR-11)
 *   /design           l'atelier des composants, qui ne fait pas partie du produit
 */
const HORS_LANGUE = ["/reponse", "/design", "/api", "/_next", "/images", "/favicon.ico"];

export function middleware(requete: NextRequest) {
  const { pathname } = requete.nextUrl;

  if (HORS_LANGUE.some((prefixe) => pathname.startsWith(prefixe))) {
    return NextResponse.next();
  }

  const premierSegment = pathname.split("/")[1];
  if (estLangue(premierSegment)) return proteger(requete, premierSegment);

  const langue = detecterLangue(requete.headers.get("accept-language"));
  const destination = requete.nextUrl.clone();
  destination.pathname = pathname === "/" ? `/${langue}` : `/${langue}${pathname}`;
  return NextResponse.redirect(destination);
}

/**
 * L'espace prestataire demande une session, sauf la candidature et la connexion :
 * un partenaire qui n'a pas encore de compte doit pouvoir postuler.
 */
const PRESTATAIRE_OUVERT = [
  "/prestataire/devenir",
  "/prestataire/candidature",
  "/prestataire/connexion",
  "/prestataire/charte",
];

/**
 * Les deux seuls écrans visiteur qui demandent une session. Tout le reste —
 * recherche, fiches, transports — se consulte sans compte (§B.1).
 */
const VISITEUR_PROTEGE = ["/compte", "/mes-demandes"];

function proteger(requete: NextRequest, langue: string) {
  const nu = requete.nextUrl.pathname.slice(langue.length + 1);

  if (nu.startsWith("/prestataire")) {
    if (PRESTATAIRE_OUVERT.some((ouvert) => nu.startsWith(ouvert))) return NextResponse.next();
    if (requete.cookies.get(COOKIE_SESSION)) return NextResponse.next();
    return versConnexion(requete, langue, "/prestataire/connexion", nu);
  }

  if (VISITEUR_PROTEGE.some((protege) => nu.startsWith(protege))) {
    if (requete.cookies.get(COOKIE_VISITEUR)) return NextResponse.next();
    return versConnexion(requete, langue, "/connexion", nu);
  }

  return NextResponse.next();
}

function versConnexion(requete: NextRequest, langue: string, page: string, suite: string) {
  const connexion = requete.nextUrl.clone();
  connexion.pathname = `/${langue}${page}`;
  connexion.searchParams.set("suite", suite);
  return NextResponse.redirect(connexion);
}

export const config = {
  // Tout sauf les fichiers servis tels quels.
  matcher: ["/((?!_next/static|_next/image|images|.*\\.[^/]+$).*)"],
};
