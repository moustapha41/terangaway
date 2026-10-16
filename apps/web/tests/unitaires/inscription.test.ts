import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Le parcours d'inscription, côté site.
 *
 * Ce qui est vérifié ici n'est pas la règle métier — l'API en est seule garante,
 * et `inscription.prisma.test.ts` s'en charge — mais la **conduite du
 * parcours** : ce que l'action valide avant d'appeler quoi que ce soit, ce
 * qu'elle met dans le cookie d'attente, à quel moment une session s'ouvre, et
 * où la personne est renvoyée ensuite.
 *
 * Le point qui structure tout : `inscrireAction` **n'ouvre aucune session**.
 */

const mockCookieJar = new Map<string, { value: string } & Record<string, unknown>>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (nom: string, valeur: string, opts: Record<string, unknown>) => {
      mockCookieJar.set(nom, { value: valeur, ...opts });
    },
    get: (nom: string) => mockCookieJar.get(nom),
    delete: (nom: string) => {
      mockCookieJar.delete(nom);
    },
  })),
  headers: vi.fn(async () => new Map()),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** `redirect()` lève, comme dans Next : les tests l'attrapent pour lire l'URL. */
class RedirectionSimulee extends Error {
  digest: string;
  constructor(public url: string) {
    super("NEXT_REDIRECT");
    this.digest = `NEXT_REDIRECT;replace;${url};307;`;
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectionSimulee(url);
  },
}));

const JETON_EMIS = `tws_${"ab12cd34".repeat(8)}`;

const apiInscrireMock = vi.fn();
const apiVerifierInscriptionMock = vi.fn();
const apiRenvoyerMock = vi.fn();
const apiConnexionMotDePasseMock = vi.fn();

vi.mock("@/lib/api/ecriture", () => ({
  apiInscrire: (...a: unknown[]) => apiInscrireMock(...a),
  apiVerifierInscription: (...a: unknown[]) => apiVerifierInscriptionMock(...a),
  apiRenvoyerCodeInscription: (...a: unknown[]) => apiRenvoyerMock(...a),
  apiConnexionMotDePasse: (...a: unknown[]) => apiConnexionMotDePasseMock(...a),
  apiObtenirSession: vi.fn(async () => {
    throw new Error("Session invalide ou expirée.");
  }),
  apiEnvoyerOtp: vi.fn(async () => ({ expireLe: "", delaiAttenteSecondes: 60 })),
  apiVerifierOtp: vi.fn(),
  apiDeconnexion: vi.fn(),
}));

/**
 * Fabrique une `ErreurApi` depuis **la même instance de module** que l'action.
 *
 * `vi.resetModules()` recharge le registre entre deux tests : une classe
 * importée statiquement en tête de fichier n'est alors plus la même que celle
 * que voit le code testé, et `instanceof` échoue silencieusement. L'import
 * dynamique, fait après la réinitialisation, retombe sur la bonne.
 */
async function erreurApi(code: string, message: string, statut: number): Promise<Error> {
  const { ErreurApi } = await import("@/lib/api/http");
  return new ErreurApi(code, message, statut);
}

/** Capture l'URL d'une redirection, ou `null` si l'action a rendu un état. */
async function urlDeRedirection(promesse: Promise<unknown>): Promise<string | null> {
  try {
    await promesse;
    return null;
  } catch (err) {
    if (err instanceof RedirectionSimulee) return err.url;
    throw err;
  }
}

function formulaire(champs: Record<string, string>): FormData {
  const data = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) data.set(cle, valeur);
  return data;
}

const INSCRIPTION_VALIDE = {
  nom: "Rokhaya Seck",
  email: "rokhaya.seck@exemple.sn",
  motDePasse: "un mot de passe assez long",
  confirmation: "un mot de passe assez long",
  langue: "fr",
};

describe("Inscription — validation côté serveur", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    mockCookieJar.clear();
    vi.resetModules();
    apiInscrireMock.mockReset();
    apiInscrireMock.mockResolvedValue({
      email: INSCRIPTION_VALIDE.email,
      expireLe: new Date(Date.now() + 600_000).toISOString(),
      delaiAttenteSecondes: 60,
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("refuse les saisies incomplètes sans appeler l'API", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");

    const rejets: Array<[string, Record<string, string>, string]> = [
      ["nom vide", { ...INSCRIPTION_VALIDE, nom: "" }, "nom"],
      ["nom d'une lettre", { ...INSCRIPTION_VALIDE, nom: "R" }, "nom"],
      ["adresse sans arobase", { ...INSCRIPTION_VALIDE, email: "pas-une-adresse" }, "email"],
      ["adresse sans domaine", { ...INSCRIPTION_VALIDE, email: "quelquun@" }, "email"],
      [
        "mot de passe trop court",
        { ...INSCRIPTION_VALIDE, motDePasse: "court", confirmation: "court" },
        "motDePasse",
      ],
    ];

    for (const [libelle, champs, champFautif] of rejets) {
      const etat = await inscrireAction({}, formulaire(champs));
      expect(etat.erreurs?.[champFautif as "nom"], libelle).toBeTruthy();
    }

    // Aucune de ces saisies n'a atteint l'API, ni posé de cookie.
    expect(apiInscrireMock).not.toHaveBeenCalled();
    expect(mockCookieJar.size).toBe(0);
  });

  it("refuse une confirmation qui ne correspond pas", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");

    const etat = await inscrireAction(
      {},
      formulaire({ ...INSCRIPTION_VALIDE, confirmation: "autre chose entierement" }),
    );

    expect(etat.erreurs?.confirmation).toBeTruthy();
    expect(apiInscrireMock).not.toHaveBeenCalled();
  });

  it("ne transmet jamais le mot de passe au cookie d'attente", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");

    await urlDeRedirection(inscrireAction({}, formulaire(INSCRIPTION_VALIDE)));

    const tout = JSON.stringify([...mockCookieJar.entries()]);
    expect(tout).not.toContain(INSCRIPTION_VALIDE.motDePasse);
    // Même encodé : le cookie est en base64url, on décode pour en être sûr.
    const cookie = mockCookieJar.get("teranga_inscription")!;
    const decode = Buffer.from(String(cookie.value), "base64url").toString("utf-8");
    expect(decode).not.toContain(INSCRIPTION_VALIDE.motDePasse);
    expect(decode).toContain(INSCRIPTION_VALIDE.email);
  });
});

describe("Inscription — aucune session avant la vérification", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    mockCookieJar.clear();
    vi.resetModules();
    apiInscrireMock.mockReset().mockResolvedValue({
      email: INSCRIPTION_VALIDE.email,
      expireLe: new Date(Date.now() + 600_000).toISOString(),
      delaiAttenteSecondes: 60,
    });
    apiVerifierInscriptionMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("pose une attente et mène à la vérification, sans cookie de session", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");

    const url = await urlDeRedirection(inscrireAction({}, formulaire(INSCRIPTION_VALIDE)));

    expect(url).toBe("/fr/inscription/verification");
    expect(apiInscrireMock).toHaveBeenCalledTimes(1);
    // Le cookie d'attente existe...
    expect(mockCookieJar.has("teranga_inscription")).toBe(true);
    // ...et surtout, aucune session n'a été ouverte.
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("marque le cookie d'attente httpOnly et de courte durée", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");
    await urlDeRedirection(inscrireAction({}, formulaire(INSCRIPTION_VALIDE)));

    const cookie = mockCookieJar.get("teranga_inscription")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    // Vingt minutes : le temps d'aller lire son courrier, pas davantage.
    expect(cookie.maxAge).toBe(20 * 60);
  });

  it("signale une adresse déjà inscrite et propose la connexion", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");
    apiInscrireMock.mockRejectedValue(
      await erreurApi("EMAIL_DEJA_UTILISE", "Un compte existe déjà avec cette adresse e-mail.", 409),
    );

    const etat = await inscrireAction({}, formulaire(INSCRIPTION_VALIDE));

    expect(etat.dejaInscrit).toBe(true);
    expect(etat.erreurs?.email).toBeTruthy();
    // Pas d'attente posée : il n'y a rien à vérifier.
    expect(mockCookieJar.has("teranga_inscription")).toBe(false);
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("rapporte un refus de débit sans le confondre avec une erreur de saisie", async () => {
    const { inscrireAction } = await import("../../src/features/compte/inscription-actions");
    apiInscrireMock.mockRejectedValue(
      await erreurApi("DELAI_ATTENTE", "Veuillez patienter 60 secondes.", 429),
    );

    const etat = await inscrireAction({}, formulaire(INSCRIPTION_VALIDE));

    expect(etat.message).toContain("60");
    expect(etat.erreurs).toBeUndefined();
  });
});

describe("Vérification — session, destination et refus", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  /** Pose une attente comme le ferait `inscrireAction`. */
  function attendre(email: string, suite?: string) {
    const valeur = Buffer.from(JSON.stringify({ email, suite }), "utf-8").toString("base64url");
    mockCookieJar.set("teranga_inscription", { value: valeur });
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    mockCookieJar.clear();
    vi.resetModules();
    apiVerifierInscriptionMock.mockReset().mockResolvedValue({
      visiteurId: "cmp_rokhaya_001",
      token: JETON_EMIS,
      compte: {
        id: "cmp_rokhaya_001",
        email: INSCRIPTION_VALIDE.email,
        nom: "Rokhaya Seck",
        estVerifie: true,
        aUnMotDePasse: true,
      },
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("ouvre la session sur le jeton émis par l'API et efface l'attente", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    attendre(INSCRIPTION_VALIDE.email);

    const url = await urlDeRedirection(
      verifierInscriptionAction({}, formulaire({ code: "481502", langue: "fr" })),
    );

    expect(url).toBe("/fr/compte");
    expect(mockCookieJar.get("teranga_visiteur")?.value).toBe(JETON_EMIS);
    // L'attente a servi, elle disparaît.
    expect(mockCookieJar.has("teranga_inscription")).toBe(false);
  });

  it("conserve la destination demandée avant l'inscription", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    attendre(INSCRIPTION_VALIDE.email, "/demande/l-002?debut=2026-10-25&fin=2026-11-01");

    const url = await urlDeRedirection(
      verifierInscriptionAction({}, formulaire({ code: "481502", langue: "fr" })),
    );

    expect(url).toBe("/fr/demande/l-002?debut=2026-10-25&fin=2026-11-01");
  });

  it("ignore une destination externe glissée dans l'attente", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    attendre(INSCRIPTION_VALIDE.email, "https://sitemechant.example/collecte");

    const url = await urlDeRedirection(
      verifierInscriptionAction({}, formulaire({ code: "481502", langue: "fr" })),
    );

    expect(url).toBe("/fr/compte");
  });

  it("prend l'adresse dans le cookie, jamais dans le formulaire", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    attendre("titulaire@exemple.sn");

    // Quelqu'un soumet l'adresse d'un autre en même temps qu'un code.
    await urlDeRedirection(
      verifierInscriptionAction(
        {},
        formulaire({ code: "481502", langue: "fr", email: "victime@exemple.sn" }),
      ),
    );

    // L'API n'a été interrogée que sur l'adresse du cookie.
    expect(apiVerifierInscriptionMock).toHaveBeenCalledWith("titulaire@exemple.sn", "481502");
  });

  it("refuse un code mal formé sans appeler l'API", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    attendre(INSCRIPTION_VALIDE.email);

    for (const code of ["", "123", "12345", "1234567", "abcdef", "12 34 56"]) {
      const etat = await verifierInscriptionAction({}, formulaire({ code, langue: "fr" }));
      expect(etat.erreur, `« ${code} »`).toBe("code");
    }
    expect(apiVerifierInscriptionMock).not.toHaveBeenCalled();
  });

  it("refuse de vérifier sans attente en cours", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    const etat = await verifierInscriptionAction({}, formulaire({ code: "481502", langue: "fr" }));

    expect(etat.erreur).toBe("introuvable");
    expect(apiVerifierInscriptionMock).not.toHaveBeenCalled();
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("distingue code faux, code expiré et plafond de tentatives", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    const cas: Array<[string, string]> = [
      ["CODE_INVALIDE", "code"],
      ["CODE_DEJA_UTILISE", "code"],
      ["CODE_EXPIRE", "expire"],
      ["TENTATIVES_DEPASSEES", "tentatives"],
      ["INSCRIPTION_INTROUVABLE", "introuvable"],
    ];

    for (const [codeApi, attendu] of cas) {
      mockCookieJar.clear();
      attendre(INSCRIPTION_VALIDE.email);
      apiVerifierInscriptionMock.mockRejectedValueOnce(await erreurApi(codeApi, "message", 401));

      const etat = await verifierInscriptionAction({}, formulaire({ code: "481502", langue: "fr" }));
      expect(etat.erreur, codeApi).toBe(attendu);
      // Aucun de ces cas n'ouvre de session.
      expect(mockCookieJar.has("teranga_visiteur"), codeApi).toBe(false);
    }
  });

  it("n'ouvre pas de session si l'API ne renvoie pas de jeton", async () => {
    const { verifierInscriptionAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    attendre(INSCRIPTION_VALIDE.email);
    // Un identifiant de compte n'est pas un jeton : il ne doit rien ouvrir.
    apiVerifierInscriptionMock.mockResolvedValue({
      visiteurId: "cmp_rokhaya_001",
      compte: { id: "cmp_rokhaya_001", estVerifie: true, aUnMotDePasse: true },
    });

    const etat = await verifierInscriptionAction({}, formulaire({ code: "481502", langue: "fr" }));

    expect(etat.erreur).toBe("serveur");
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });
});

describe("Connexion par mot de passe — conduite du parcours", () => {
  const envInitial = process.env.NEXT_PUBLIC_API_MOCK;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
    mockCookieJar.clear();
    vi.resetModules();
    apiConnexionMotDePasseMock.mockReset().mockResolvedValue({
      visiteurId: "cmp_rokhaya_001",
      token: JETON_EMIS,
      compte: {
        id: "cmp_rokhaya_001",
        email: INSCRIPTION_VALIDE.email,
        estVerifie: true,
        aUnMotDePasse: true,
      },
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = envInitial;
  });

  it("ouvre la session et honore la destination", async () => {
    const { connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    const url = await urlDeRedirection(
      connexionMotDePasseAction(
        {},
        formulaire({
          email: INSCRIPTION_VALIDE.email,
          motDePasse: INSCRIPTION_VALIDE.motDePasse,
          suite: "/compte/reservations",
          langue: "fr",
        }),
      ),
    );

    expect(url).toBe("/fr/compte/reservations");
    expect(mockCookieJar.get("teranga_visiteur")?.value).toBe(JETON_EMIS);
  });

  it("refuse une saisie vide sans appeler l'API", async () => {
    const { connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );

    const etat = await connexionMotDePasseAction(
      {},
      formulaire({ email: INSCRIPTION_VALIDE.email, motDePasse: "", langue: "fr" }),
    );

    expect(etat.erreur).toBe("identifiants");
    expect(apiConnexionMotDePasseMock).not.toHaveBeenCalled();
  });

  it("rouvre une attente de vérification quand l'adresse n'est pas confirmée", async () => {
    const { connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    apiConnexionMotDePasseMock.mockRejectedValue(
      await erreurApi("COMPTE_NON_VERIFIE", "Adresse non confirmée.", 403),
    );

    const etat = await connexionMotDePasseAction(
      {},
      formulaire({
        email: INSCRIPTION_VALIDE.email,
        motDePasse: INSCRIPTION_VALIDE.motDePasse,
        langue: "fr",
      }),
    );

    expect(etat.erreur).toBe("non_verifie");
    // Une attente est reposée : la personne peut aller vérifier au lieu de
    // rester devant un refus sans issue.
    expect(mockCookieJar.has("teranga_inscription")).toBe(true);
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("ne distingue pas adresse inconnue et mot de passe faux", async () => {
    const { connexionMotDePasseAction } = await import(
      "../../src/features/compte/inscription-actions"
    );
    apiConnexionMotDePasseMock.mockRejectedValue(
      await erreurApi(
        "IDENTIFIANTS_INVALIDES",
        "L'adresse e-mail ou le mot de passe ne correspond pas.",
        401,
      ),
    );

    const etat = await connexionMotDePasseAction(
      {},
      formulaire({ email: "inconnu@exemple.sn", motDePasse: "quelque chose", langue: "fr" }),
    );

    expect(etat.erreur).toBe("identifiants");
    expect(mockCookieJar.has("teranga_visiteur")).toBe(false);
  });
});
