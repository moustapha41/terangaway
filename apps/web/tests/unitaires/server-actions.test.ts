import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieJar = new Map<string, any>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (name: string, value: any, opts: any) => {
      mockCookieJar.set(name, { value, ...opts });
    },
    get: (name: string) => mockCookieJar.get(name),
    delete: (name: string) => {
      mockCookieJar.delete(name);
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import {
  creerDemandeLogementAction,
  creerDemandeTransportAction,
} from "../../src/features/demande/actions";
import { creerDemandeServiceAction } from "../../src/features/services/actions";
import { estJetonSessionValide } from "../../src/features/compte/cookie";

describe("Server Actions - Validation et création demande de logement", () => {
  beforeEach(() => {
    mockCookieJar.clear();
  });

  it("rejette une demande sans identifiant de logement", async () => {
    const res = await creerDemandeLogementAction({
      logementId: "",
      debut: "2026-11-01",
      fin: "2026-11-05",
      personnes: 2,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Identifiant de logement requis.");
    }
  });

  it("rejette une demande avec dates inversées ou incohérentes", async () => {
    const res = await creerDemandeLogementAction({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-05",
      personnes: 2,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Dates de séjour invalides.");
    }
  });

  it("rejette une demande avec nombre de personnes invalide (<= 0)", async () => {
    const res = await creerDemandeLogementAction({
      logementId: "l-001",
      debut: "2026-11-01",
      fin: "2026-11-05",
      personnes: 0,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Nombre de personnes invalide.");
    }
  });

  it("gère le cas d'un code OTP erroné", async () => {
    const res = await creerDemandeLogementAction(
      {
        logementId: "l-001",
        debut: "2026-11-01",
        fin: "2026-11-05",
        personnes: 2,
        code: "999999",
      },
      "code-faux",
    );
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("code_invalide");
      expect(res.raison).toBe("faux");
    }
  });

  it("gère le cas d'un logement indisponible avec alternatives", async () => {
    const res = await creerDemandeLogementAction(
      {
        logementId: "l-001",
        debut: "2026-11-01",
        fin: "2026-11-05",
        personnes: 2,
      },
      "pris",
    );
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("logement_pris");
      expect(Array.isArray(res.alternatives)).toBe(true);
      expect((res.alternatives?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("crée avec succès une demande de logement valide et ouvre la session", async () => {
    const res = await creerDemandeLogementAction(
      {
        logementId: "l-001",
        debut: "2026-11-01",
        fin: "2026-11-05",
        personnes: 2,
        message: "Arrivée prévue vers 14h",
        code: "123456",
      },
      "normal",
      { email: "visiteur@example.com" },
    );
    expect(res.succes).toBe(true);
    if (res.succes) {
      expect(res.demande).toBeDefined();
      expect(res.demande.statut).toBe("envoyee");
      expect(res.demande.reference).toMatch(/^TW-/);
    }
    // Vérifie que le cookie de session visiteur a été positionné
    expect(mockCookieJar.has("teranga_visiteur")).toBe(true);
  });
});

describe("Server Actions - Validation et création demande de transport", () => {
  beforeEach(() => {
    mockCookieJar.clear();
  });

  it("rejette une demande sans véhicule", async () => {
    const res = await creerDemandeTransportAction({
      vehiculeId: "",
      prestation: "trajet",
      depart: "AIBD",
      quand: "2026-11-01T14:00:00Z",
      passagers: 2,
      bagages: 1,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Véhicule requis.");
    }
  });

  it("rejette une demande avec prestation invalide", async () => {
    const res = await creerDemandeTransportAction({
      vehiculeId: "v-001",
      prestation: "inconnu" as any,
      depart: "AIBD",
      quand: "2026-11-01T14:00:00Z",
      passagers: 2,
      bagages: 1,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Prestation de transport invalide.");
    }
  });

  it("rejette une demande sans lieu de départ", async () => {
    const res = await creerDemandeTransportAction({
      vehiculeId: "v-001",
      prestation: "trajet",
      depart: "   ",
      quand: "2026-11-01T14:00:00Z",
      passagers: 2,
      bagages: 1,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Lieu de départ requis.");
    }
  });

  it("rejette une demande avec passagers <= 0", async () => {
    const res = await creerDemandeTransportAction({
      vehiculeId: "v-001",
      prestation: "trajet",
      depart: "AIBD",
      quand: "2026-11-01T14:00:00Z",
      passagers: 0,
      bagages: 0,
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Nombre de passagers invalide.");
    }
  });

  it("crée avec succès une demande de transport valide", async () => {
    const res = await creerDemandeTransportAction(
      {
        vehiculeId: "v-001",
        prestation: "trajet",
        depart: "Aéroport AIBD",
        arrivee: "Dakar Plateau",
        quand: "2026-11-01T14:00:00Z",
        passagers: 2,
        bagages: 2,
      },
      "normal",
      { telephone: "+221770000000" },
    );
    expect(res.succes).toBe(true);
    if (res.succes) {
      expect(res.demande).toBeDefined();
      expect(res.demande.statut).toBe("envoyee");
      expect(res.demande.reference).toMatch(/^TW-/);
    }
  });
});

describe("Server Actions - Validation et création demande de service", () => {
  beforeEach(() => {
    mockCookieJar.clear();
  });

  it("rejette une demande sans type de service", async () => {
    const res = await creerDemandeServiceAction({
      service: "" as any,
      details: {},
    });
    expect(res.succes).toBe(false);
    if (!res.succes) {
      expect(res.erreur).toBe("validation");
      expect(res.message).toBe("Type de service requis.");
    }
  });

  it("crée avec succès une demande de service", async () => {
    const res = await creerDemandeServiceAction(
      {
        service: "restauration",
        details: { couverts: "4", regime: "halal", date: "2026-11-02" },
        message: "Dîner d'affaires",
      },
      { email: "visiteur@teranga.sn" },
    );
    expect(res.succes).toBe(true);
    if (res.succes) {
      expect(res.demande).toBeDefined();
      expect(res.demande.statut).toBe("envoyee");
      expect(res.demande.reference).toMatch(/^TW-/);
    }
  });
});

describe("Gestion de la session visiteur & multi-réservations sans réauthentification", () => {
  beforeEach(() => {
    mockCookieJar.clear();
  });

  it("estJetonSessionValide rejette formellement les valeurs legacy et falsifiées", () => {
    // Adresses e-mail
    expect(estJetonSessionValide("visiteur@terangaway.sn")).toBe(false);
    expect(estJetonSessionValide("test@exemple.com")).toBe(false);

    // Valeur de démonstration compromise
    expect(estJetonSessionValide("visiteur-demo")).toBe(false);

    // Chaînes trop courtes ou corrompues
    expect(estJetonSessionValide("abc")).toBe(false);
    expect(estJetonSessionValide("")).toBe(false);
    expect(estJetonSessionValide(null)).toBe(false);
    expect(estJetonSessionValide(undefined)).toBe(false);

    // Jeton valide (hexadécimal >= 16 caractères ou mock sécurisé)
    expect(
      estJetonSessionValide("a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef"),
    ).toBe(true);
    expect(
      estJetonSessionValide("session-mock-766973697465757240746573742e736e"),
    ).toBe(true);
  });

  it("visiteurConnecte ignore les cookies contenant un e-mail ou visiteur-demo", async () => {
    const { visiteurConnecte } = await import("../../src/features/compte/session");

    // Cookie contenant une adresse e-mail
    mockCookieJar.set("teranga_visiteur", { value: "visiteur@teranga.sn" });
    const visEmail = await visiteurConnecte();
    expect(visEmail).toBeNull();

    // Cookie contenant 'visiteur-demo'
    mockCookieJar.set("teranga_visiteur", { value: "visiteur-demo" });
    const visDemo = await visiteurConnecte();
    expect(visDemo).toBeNull();
  });

  it("effectue plusieurs réservations consécutives (logement puis transport) avec session active sans redemander d'OTP et sans écraser le cookie", async () => {
    const tokenValide = "session-mock-766973697465757240746573742e736e";
    mockCookieJar.set("teranga_visiteur", {
      value: tokenValide,
      maxAge: 30 * 24 * 3600,
    });

    // 1ère réservation : Logement (aucun code OTP fourni)
    const resLogement = await creerDemandeLogementAction(
      {
        logementId: "l-001",
        debut: "2026-11-01",
        fin: "2026-11-05",
        personnes: 2,
        message: "Séjour Jeux Olympiques de la Jeunesse",
      },
      "normal",
      { email: "visiteur@test.sn" },
    );

    expect(resLogement.succes).toBe(true);
    if (resLogement.succes) {
      expect(resLogement.demande.statut).toBe("envoyee");
    }

    // Le cookie de session N'A PAS ÉTÉ ÉCRASÉ par l'adresse email
    expect(mockCookieJar.get("teranga_visiteur").value).toBe(tokenValide);
    expect(mockCookieJar.get("teranga_visiteur").value).not.toBe("visiteur@test.sn");

    // 2ème réservation consécutive : Transport (aucun code OTP fourni)
    const resTransport = await creerDemandeTransportAction(
      {
        vehiculeId: "v-001",
        prestation: "trajet",
        depart: "Aéroport International Blaise Diagne",
        arrivee: "Dakar Plateau",
        quand: "2026-11-01T15:00:00Z",
        passagers: 2,
        bagages: 2,
      },
      "normal",
      { email: "visiteur@test.sn" },
    );

    expect(resTransport.succes).toBe(true);
    if (resTransport.succes) {
      expect(resTransport.demande.statut).toBe("envoyee");
    }

    // Le cookie de session est toujours inchangé et valide
    expect(mockCookieJar.get("teranga_visiteur").value).toBe(tokenValide);
  });

  it("ouvrirSession refuse d'écraser un cookie de session avec une adresse e-mail", async () => {
    const { ouvrirSession } = await import("../../src/features/compte/actions");
    const tokenInitial = "session-mock-initial-token-123456789";
    mockCookieJar.set("teranga_visiteur", { value: tokenInitial });

    // Tentative d'écrasement avec une adresse e-mail
    await ouvrirSession("visiteur@exemple.com");

    // Le cookie conserve le jeton initial et n'a pas été remplacé par l'e-mail
    expect(mockCookieJar.get("teranga_visiteur").value).toBe(tokenInitial);
  });
});
