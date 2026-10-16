import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "../../src/middleware";

/**
 * Le garde-fou de navigation, vu depuis l'extérieur.
 *
 * Ce fichier rejoue l'audit de production. Les requêtes ci-dessous sont
 * exactement celles qui ont été envoyées au site public :
 *
 *     curl -H "Cookie: teranga_visiteur=x"             .../fr/compte/reservations  → 200
 *     curl -H "Cookie: teranga_visiteur=visiteur-demo" .../fr/compte/reservations  → 200
 *     curl -H "Cookie: teranga_visiteur=test@exemple"  .../fr/compte/reservations  → 200
 *
 * Les trois ouvraient l'espace client, parce que le middleware testait
 * `if (requete.cookies.get(COOKIE_VISITEUR))` — la présence, pas la valeur.
 *
 * Rappel de portée, pour que personne ne s'y trompe en lisant ces tests : le
 * middleware ne filtre que la **forme** du cookie. Il n'appelle pas l'API, et
 * ne peut donc pas savoir si la session existe. C'est `visiteurConnecte()`,
 * dans chaque page privée, qui tranche — voir `securite-session.test.ts`.
 */
const DOMAINE = "https://teranga-way.com";

/** Un jeton de la forme réellement émise par l'API : `tws_` + 64 hex. */
const JETON_EMIS = `tws_${"ab12cd34".repeat(8)}`;

function naviguer(chemin: string, cookie?: string) {
  const requete = new NextRequest(new URL(chemin, DOMAINE), {
    headers: cookie ? { cookie: `teranga_visiteur=${cookie}` } : undefined,
  });
  const reponse = middleware(requete);
  return {
    statut: reponse.status,
    destination: reponse.headers.get("location"),
  };
}

/** Les deux seuls espaces visiteur qui demandent une session (§B.1). */
const ROUTES_PRIVEES = [
  "/fr/compte",
  "/fr/compte/reservations",
  "/fr/compte/reservations/d-001",
  "/fr/compte/profil",
  "/fr/compte/messages",
  "/fr/mes-demandes",
  "/fr/mes-demandes/d-001",
];

describe("Sécurité du middleware — l'espace client n'est pas ouvert par un cookie quelconque", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    // La configuration du site déployé.
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("renvoie vers la connexion sans cookie, en conservant la destination", () => {
    for (const route of ROUTES_PRIVEES) {
      const { statut, destination } = naviguer(route);
      expect(statut, route).toBe(307);
      expect(destination, route).toContain("/fr/connexion");
      // La destination est conservée : on revient où l'on allait.
      expect(destination, route).toContain("suite=");
    }
  });

  it("refuse les trois cookies qui ouvraient l'espace client en production", () => {
    const forges = ["x", "visiteur-demo", "test@exemple.com"];

    for (const cookie of forges) {
      for (const route of ROUTES_PRIVEES) {
        const { statut, destination } = naviguer(route, cookie);
        expect(statut, `${route} avec « ${cookie} »`).toBe(307);
        expect(destination, `${route} avec « ${cookie} »`).toContain("/fr/connexion");
      }
    }
  });

  it("refuse un cookie long mais reconnaissable comme non-jeton", () => {
    for (const cookie of [
      // Une adresse e-mail, même longue : c'est une identité, pas un secret.
      "rokhaya.seck@exemple.sn",
      // Un jeton simulé alors que c'est la vraie API qui répond.
      "session-mock-766973697465757240746573742e736e",
      // Une valeur publique entourée d'espaces.
      "          visiteur-demo          ",
    ]) {
      const { statut } = naviguer("/fr/compte/reservations", cookie);
      expect(statut, cookie).toBe(307);
    }
  });

  it("laisse passer une chaîne opaque, dont le refus incombe à la page", () => {
    // Trente caractères sans signification : le middleware ne peut pas savoir,
    // et il ne doit pas deviner. C'est volontaire et c'est la limite du filtre
    // de forme — l'étanchéité vient de `visiteurConnecte()` côté page, couverte
    // par « un cookie de forme plausible mais inconnu de l'API n'ouvre aucune
    // session » dans `securite-session.test.ts`.
    //
    // Ce test existe pour que la limite soit écrite noir sur blanc : si
    // quelqu'un durcit un jour le middleware, il saura que ce 200 était un
    // choix et non un oubli.
    const { statut } = naviguer("/fr/compte/reservations", "a".repeat(30));
    expect(statut).toBe(200);
  });

  it("laisse passer un cookie de forme valide, la session restant à vérifier par la page", () => {
    for (const route of ROUTES_PRIVEES) {
      const { statut } = naviguer(route, JETON_EMIS);
      // 200 ici ne veut pas dire « authentifié » : la page appellera
      // `visiteurConnecte()` et redirigera si l'API ne connaît pas ce jeton.
      expect(statut, route).toBe(200);
    }
  });

  it("laisse les écrans publics librement consultables (§B.1)", () => {
    const publiques = [
      "/fr",
      "/fr/logements",
      "/fr/logements/villa-ngaparou-quatre-suites",
      "/fr/transports",
      "/fr/demande/l-002",
      "/fr/connexion",
      "/fr/aide",
      "/fr/a-propos",
    ];

    for (const route of publiques) {
      const { statut } = naviguer(route);
      expect(statut, route).toBe(200);
    }
  });

  it("protège l'espace prestataire, sauf candidature et connexion", () => {
    for (const route of ["/fr/prestataire", "/fr/prestataire/offres", "/fr/prestataire/reservations"]) {
      expect(naviguer(route).statut, route).toBe(307);
    }
    for (const ouvert of [
      "/fr/prestataire/devenir",
      "/fr/prestataire/candidature",
      "/fr/prestataire/connexion",
    ]) {
      expect(naviguer(ouvert).statut, ouvert).toBe(200);
    }
  });

  it("n'accepte pas une destination externe comme page de retour", () => {
    // `suite` est relu par `resoudreDestination`, mais autant vérifier qu'une
    // URL absolue n'arrive pas jusque-là par le chemin du middleware.
    const { destination } = naviguer("/fr/compte");
    expect(destination).not.toContain("http://evil");
    expect(destination).toMatch(/^https:\/\/teranga-way\.com\/fr\/connexion/);
  });
});
