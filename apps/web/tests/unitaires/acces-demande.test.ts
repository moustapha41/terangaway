import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Demande } from "@teranga/contracts";

const cookieJar = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (name: string, value: string) => cookieJar.set(name, { value }),
    get: (name: string) => cookieJar.get(name),
    delete: (name: string) => cookieJar.delete(name),
  })),
  headers: vi.fn(async () => new Headers()),
}));

class Redirection extends Error {
  constructor(public readonly cible: string) {
    super(cible);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (cible: string) => {
    throw new Redirection(cible);
  },
}));

import { ouvrirDemandeParLien } from "../../src/features/demande/acces-actions";
import {
  lireRecapitulatif,
  poserRecapitulatif,
  recapitulatifDe,
} from "../../src/features/demande/recapitulatif";

const JETON = "twl_" + "a".repeat(64);
const SESSION = "tws_" + "b".repeat(64);

function formulaire(jeton = JETON) {
  const f = new FormData();
  f.set("jeton", jeton);
  f.set("locale", "fr");
  return f;
}

async function cible(): Promise<string> {
  try {
    await ouvrirDemandeParLien(formulaire());
  } catch (e) {
    if (e instanceof Redirection) return e.cible;
    throw e;
  }
  throw new Error("aucune redirection");
}

function repondre(statut: number, corps: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(corps), { status: statut }));
}

describe("Lien d'accès à une demande — côté site", () => {
  const apiInitiale = process.env.NEXT_PUBLIC_API_MOCK;
  beforeEach(() => {
    cookieJar.clear();
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = apiInitiale;
    vi.unstubAllGlobals();
  });

  it("ouvre la session et mène à la demande désignée par l'API", async () => {
    const fetchSimule = repondre(200, {
      donnees: { visiteurId: "c1", token: SESSION, demandeId: "d-7" },
    });
    vi.stubGlobal("fetch", fetchSimule);

    expect(await cible()).toBe("/fr/mes-demandes/d-7");
    expect(cookieJar.get("teranga_visiteur")?.value).toBe(SESSION);

    // Le jeton voyage dans le corps de la requête, pas dans son URL.
    const [url, init] = fetchSimule.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(JETON);
    expect(JSON.parse(String(init.body))).toEqual({ jeton: JETON });
  });

  it.each([
    ["LIEN_EXPIRE", 401],
    ["LIEN_DEJA_UTILISE", 401],
    ["LIEN_INVALIDE", 401],
    ["TROP_DE_TENTATIVES", 429],
  ])("renvoie vers la page du lien avec le refus %s, sans session", async (code, statut) => {
    vi.stubGlobal("fetch", repondre(statut, { erreur: { code, message: "refus" } }));

    expect(await cible()).toBe(`/fr/acces-demande/${JETON}?refus=${code}`);
    expect(cookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("traite une panne de l'API comme un lien invalide, sans session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));

    expect(await cible()).toBe(`/fr/acces-demande/${JETON}?refus=LIEN_INVALIDE`);
    expect(cookieJar.has("teranga_visiteur")).toBe(false);
  });

  it("n'ouvre rien si l'API ne renvoie pas un vrai jeton de session", async () => {
    vi.stubGlobal(
      "fetch",
      repondre(200, { donnees: { visiteurId: "c1", token: "court", demandeId: "d-7" } }),
    );

    expect(await cible()).toBe(`/fr/acces-demande/${JETON}?refus=LIEN_INVALIDE`);
    expect(cookieJar.has("teranga_visiteur")).toBe(false);
  });
});

describe("Récapitulatif de confirmation", () => {
  beforeEach(() => cookieJar.clear());

  const demande = {
    id: "d-9",
    reference: "TW-424242",
    statut: "envoyee",
    offre: { genre: "logement", logementId: "l-1", titre: "Villa Almadies", vignette: "" },
    dates: { debut: "2026-11-01", fin: "2026-11-08" },
    personnes: 3,
    prix: { prixParNuit: 40000, nuits: 7, fraisFixes: [], total: 295000 },
    frise: [],
  } as unknown as Demande;

  it("reprend les valeurs enregistrées, et rien de plus", async () => {
    await poserRecapitulatif(recapitulatifDe(demande, true));
    expect(await lireRecapitulatif()).toEqual({
      id: "d-9",
      reference: "TW-424242",
      titre: "Villa Almadies",
      debut: "2026-11-01",
      fin: "2026-11-08",
      personnes: 3,
      heureArrivee: undefined,
      total: 295000,
      statut: "envoyee",
      emailEnvoye: true,
      acompteAnnonce: false,
    });
  });

  it("n'invente ni horaire ni montant absents", () => {
    const recap = recapitulatifDe({ ...demande, prix: { total: 0 } } as Demande, false);
    expect(recap.heureArrivee).toBeUndefined();
    expect(recap.total).toBeUndefined();
    expect(recap.emailEnvoye).toBe(false);
  });

  it("ne promet l'e-mail que s'il est explicitement parti", async () => {
    await poserRecapitulatif({ ...recapitulatifDe(demande, false) });
    expect((await lireRecapitulatif())?.emailEnvoye).toBe(false);

    cookieJar.set("teranga_recap", { value: JSON.stringify({ ...recapitulatifDe(demande, true), emailEnvoye: "oui" }) });
    expect((await lireRecapitulatif())?.emailEnvoye).toBe(false);
  });

  it("ignore un cookie illisible ou incomplet", async () => {
    cookieJar.set("teranga_recap", { value: "{pas du json" });
    expect(await lireRecapitulatif()).toBeNull();
    cookieJar.set("teranga_recap", { value: JSON.stringify({ reference: "TW-1" }) });
    expect(await lireRecapitulatif()).toBeNull();
  });
});

describe("Fichiers d'actions serveur", () => {
  it("n'exportent que des fonctions : Next refuse tout autre export au rendu", async () => {
    // Régression réelle : une constante exportée d'un fichier "use server" a
    // fait répondre 500 à la page du lien, sans qu'aucun autre test ne le voie.
    for (const module of [
      await import("../../src/features/demande/acces-actions"),
      await import("../../src/features/demande/actions"),
    ]) {
      for (const [nom, valeur] of Object.entries(module)) {
        expect(typeof valeur, `export « ${nom} »`).toBe("function");
      }
    }
  });
});

describe("Récapitulatif — paiement annoncé", () => {
  beforeEach(() => cookieJar.clear());
  const base = {
    id: "d-9", reference: "TW-1", statut: "envoyee",
    offre: { genre: "logement", logementId: "l", titre: "Villa", vignette: "" },
    dates: { debut: "2026-11-01", fin: "2026-11-08" }, personnes: 1, prix: { total: 1000 }, frise: [],
  } as unknown as Demande;

  it("n'annonce aucun paiement par défaut", async () => {
    await poserRecapitulatif(recapitulatifDe(base, true));
    expect((await lireRecapitulatif())?.acompteAnnonce).toBe(false);
  });

  it("ne l'annonce que si c'est explicitement vrai", async () => {
    await poserRecapitulatif(recapitulatifDe(base, true, true));
    expect((await lireRecapitulatif())?.acompteAnnonce).toBe(true);
    cookieJar.set("teranga_recap", { value: JSON.stringify({ ...recapitulatifDe(base, true), acompteAnnonce: "oui" }) });
    expect((await lireRecapitulatif())?.acompteAnnonce).toBe(false);
  });
});
