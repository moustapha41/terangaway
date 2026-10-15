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
