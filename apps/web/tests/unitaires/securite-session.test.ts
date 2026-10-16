import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests de sécurité de la session visiteur.
 *
 * Chacun correspond à un accès qui a réellement été accordé en production :
 *
 *  · `teranga_visiteur=<n'importe quoi>` ouvrait l'espace client, parce que le
 *    middleware ne regardait que la *présence* du cookie ;
 *  · `visiteur-demo` était accepté comme jeton de session ;
 *  · l'adresse e-mail du visiteur était posée *comme* jeton de session ;
 *  · un identifiant de compte suffisait à résoudre une session.
 *
 * Ils sont écrits en mode « API réelle » (`NEXT_PUBLIC_API_MOCK=false`), c'est-
 * à-dire dans la configuration du site déployé.
 */

const mockCookieJar = new Map<string, { value: string } & Record<string, unknown>>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      mockCookieJar.set(name, { value, ...opts });
    },
    get: (name: string) => mockCookieJar.get(name),
    delete: (name: string) => {
      mockCookieJar.delete(name);
    },
  })),
  headers: vi.fn(async () => new Map()),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * L'API, vue depuis le site : elle n'accepte qu'un jeton qu'elle a elle-même
 * émis. Tout le reste est une session invalide, comme en vrai.
 */
const JETON_EMIS = `tws_${"ab12cd34".repeat(8)}`;
const apiObtenirSessionMock = vi.fn(async (token?: string) => {
  if (token === JETON_EMIS) {
    return {
      visiteur: {
        compteId: "cmp_reel_001",
        email: "rokhaya.seck@exemple.sn",
        telephone: "+221770000001",
        token: JETON_EMIS,
      },
    };
  }
  throw new Error("Session invalide ou expirée.");
});

vi.mock("@/lib/api/ecriture", () => ({
  apiObtenirSession: (token?: string) => apiObtenirSessionMock(token),
  apiEnvoyerOtp: vi.fn(async () => ({
    expireLe: new Date(Date.now() + 600_000).toISOString(),
    delaiAttenteSecondes: 60,
  })),
  apiVerifierOtp: vi.fn(async () => ({ visiteurId: "cmp_reel_001", token: JETON_EMIS })),
  apiDeconnexion: vi.fn(async () => ({ deconnecte: true })),
}));

import { estJetonSessionValide, PREFIXE_JETON_MOCK } from "../../src/features/compte/cookie";

describe("Sécurité — forme du jeton de session", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    // La configuration du site déployé.
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("refuse toutes les valeurs qui ont servi de session en production", () => {
    const refusees = [
      // Observées sur le site public.
      "visiteur-demo",
      "Visiteur-Demo",
      "  visiteur-demo  ",
      // Une adresse e-mail est une identité, pas une preuve d'identité.
      "visiteur@teranga-way.com",
      "rokhaya.seck@exemple.sn",
      // Cookies forgés à la main lors de l'audit.
      "x",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@",
      // Valeurs publiques diverses.
      "visiteur",
      "demo",
      "undefined",
      "null",
      // Rien, ou presque.
      "",
      "   ",
      "abc",
    ];

    for (const valeur of refusees) {
      expect(estJetonSessionValide(valeur), `« ${valeur} » doit être refusé`).toBe(false);
    }

    expect(estJetonSessionValide(null)).toBe(false);
    expect(estJetonSessionValide(undefined)).toBe(false);
  });

  it("refuse une valeur contenant un espace ou un retour à la ligne", () => {
    expect(estJetonSessionValide("tws_aaaaaaaaaaaa bbbbbbbbbbbb")).toBe(false);
    expect(estJetonSessionValide("tws_aaaaaaaaaaaa\nbbbbbbbbbbbb")).toBe(false);
  });

  it("accepte un jeton de la forme réellement émise par l'API", () => {
    // `genererJetonSession()` côté API : `tws_` + 64 caractères hexadécimaux.
    expect(estJetonSessionValide(JETON_EMIS)).toBe(true);
    expect(JETON_EMIS).toHaveLength(68);
  });

  it("refuse un jeton simulé quand c'est la vraie API qui répond", () => {
    const jetonSimule = `${PREFIXE_JETON_MOCK}766973697465757240746573742e736e`;

    // Site déployé : le mock ne répond pas, ce jeton ne vaut rien.
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    expect(estJetonSessionValide(jetonSimule)).toBe(false);

    // Poste de développement : il est légitime.
    process.env.NEXT_PUBLIC_API_MOCK = "true";
    expect(estJetonSessionValide(jetonSimule)).toBe(true);
  });
});

describe("Sécurité — la session est tranchée par le serveur, pas par le cookie", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    mockCookieJar.clear();
    apiObtenirSessionMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("un cookie de forme plausible mais inconnu de l'API n'ouvre aucune session", async () => {
    const { visiteurConnecte } = await import("../../src/features/compte/session");

    // Forme valide — 68 caractères, préfixe crédible — mais jamais émis.
    mockCookieJar.set("teranga_visiteur", { value: `tws_${"ff00ff00".repeat(8)}` });

    expect(await visiteurConnecte()).toBeNull();
    // Le serveur a bien été interrogé : la décision ne vient pas du cookie.
    expect(apiObtenirSessionMock).toHaveBeenCalledTimes(1);
  });

  it("ne consulte même pas l'API pour visiteur-demo ou une adresse e-mail", async () => {
    const { visiteurConnecte } = await import("../../src/features/compte/session");

    for (const valeur of ["visiteur-demo", "visiteur@teranga-way.com"]) {
      mockCookieJar.set("teranga_visiteur", { value: valeur });
      expect(await visiteurConnecte()).toBeNull();
    }

    // Écartées sur la forme : aucun aller-retour inutile vers l'API.
    expect(apiObtenirSessionMock).not.toHaveBeenCalled();
  });

  it("ouvre la session et rend le compte de l'API pour un jeton réellement émis", async () => {
    const { visiteurConnecte } = await import("../../src/features/compte/session");
    mockCookieJar.set("teranga_visiteur", { value: JETON_EMIS });

    const visiteur = await visiteurConnecte();
    expect(visiteur).not.toBeNull();
    // L'identité vient de l'API, jamais du contenu du cookie.
    expect(visiteur?.compteId).toBe("cmp_reel_001");
    expect(visiteur?.email).toBe("rokhaya.seck@exemple.sn");
    expect(visiteur?.token).toBe(JETON_EMIS);
  });
});

describe("Sécurité — ouverture de session", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    mockCookieJar.clear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("refuse d'écraser un jeton existant par une adresse e-mail", async () => {
    const { ouvrirSession } = await import("../../src/features/compte/actions");
    mockCookieJar.set("teranga_visiteur", { value: JETON_EMIS });

    await expect(ouvrirSession("rokhaya.seck@exemple.sn")).resolves.toBe(false);
    expect(mockCookieJar.get("teranga_visiteur")?.value).toBe(JETON_EMIS);
  });

  it("refuse d'ouvrir une session sur un identifiant de compte", async () => {
    const { ouvrirSessionVerifiee } = await import("../../src/features/compte/actions");

    // L'API n'a pas renvoyé de jeton : retomber sur `visiteurId` posait un
    // cookie que l'API refusait ensuite, et le visiteur paraissait déconnecté
    // juste après avoir saisi un code correct.
    await expect(ouvrirSessionVerifiee({ visiteurId: "cmp_reel_001" })).resolves.toBe(false);
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("ouvre la session, en cookie httpOnly et de portée limitée, sur un vrai jeton", async () => {
    const { ouvrirSession } = await import("../../src/features/compte/actions");

    await expect(ouvrirSession(JETON_EMIS)).resolves.toBe(true);

    const pose = mockCookieJar.get("teranga_visiteur");
    expect(pose?.value).toBe(JETON_EMIS);
    expect(pose?.httpOnly).toBe(true);
    expect(pose?.sameSite).toBe("lax");
    expect(pose?.path).toBe("/");
  });
});
