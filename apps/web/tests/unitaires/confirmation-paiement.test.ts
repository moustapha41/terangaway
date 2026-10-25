import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

import { confirmer } from "../../src/features/demande/actions";

function formulaire(locale = "fr") {
  const f = new FormData();
  f.set("id", "d-1");
  f.set("locale", locale);
  return f;
}

async function cible(locale?: string): Promise<string | null> {
  try {
    await confirmer(formulaire(locale));
  } catch (e) {
    if (e instanceof Redirection) return e.cible;
    throw e;
  }
  return null;
}

describe("Confirmation d'une demande — acompte non vérifié", () => {
  const apiInitiale = process.env.NEXT_PUBLIC_API_MOCK;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = apiInitiale;
    vi.unstubAllGlobals();
  });

  const repondre = (statut: number, corps: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(corps), { status: statut }));

  it("renvoie le visiteur vers sa demande avec un message, au lieu d'un bouton muet", async () => {
    vi.stubGlobal("fetch", repondre(409, { erreur: { code: "ACOMPTE_NON_PAYE", message: "x" } }));
    expect(await cible("fr")).toBe("/fr/mes-demandes/d-1?paiement=attendu");
    expect(await cible("en")).toBe("/en/mes-demandes/d-1?paiement=attendu");
  });

  it("renvoie vers un message explicite quand l'offre vient d'être confirmée par une autre réservation", async () => {
    vi.stubGlobal("fetch", repondre(409, { erreur: { code: "OFFRE_DEJA_CONFIRMEE", message: "x" } }));
    expect(await cible("fr")).toBe("/fr/mes-demandes/d-1?confirmation=offre-prise");
    expect(await cible("es")).toBe("/es/mes-demandes/d-1?confirmation=offre-prise");
  });

  it("distingue les deux refus : acompte non vérifié, offre prise", async () => {
    vi.stubGlobal("fetch", repondre(409, { erreur: { code: "ACOMPTE_NON_PAYE", message: "x" } }));
    expect(await cible()).toContain("paiement=attendu");
    vi.stubGlobal("fetch", repondre(409, { erreur: { code: "OFFRE_DEJA_CONFIRMEE", message: "x" } }));
    expect(await cible()).toContain("confirmation=offre-prise");
  });

  it("n'accepte qu'une langue connue pour la redirection", async () => {
    vi.stubGlobal("fetch", repondre(409, { erreur: { code: "ACOMPTE_NON_PAYE", message: "x" } }));
    expect(await cible("//evil.example")).toBe("/fr/mes-demandes/d-1?paiement=attendu");
  });

  it("ne redirige pas quand la confirmation réussit", async () => {
    vi.stubGlobal("fetch", repondre(201, { donnees: { id: "d-1", statut: "confirmee" } }));
    expect(await cible()).toBeNull();
  });

  it("ne change pas le comportement des autres refus (la demande n'est simplement pas confirmée)", async () => {
    vi.stubGlobal("fetch", repondre(409, { erreur: { code: "TRANSITION_INTERDITE", message: "x" } }));
    expect(await cible()).toBeNull();
  });
});

describe("Textes — jamais de confirmation avant sa réalité", () => {
  const messages = Object.fromEntries(
    ["fr", "en", "es"].map((l) => [l, JSON.parse(readFileSync(join(__dirname, `../../src/messages/${l}.json`), "utf8"))]),
  );

  it.each(["fr", "en", "es"])("%s : le message de refus dit que l'acompte n'est pas vérifié et qu'une preuve ne suffit pas", (langue) => {
    const t: string = messages[langue].detailDemande.paiementAttendu;
    expect(t.length).toBeGreaterThan(40);
    expect(t).toMatch(/pas (encore )?(été )?vérifié|not (yet )?(been )?checked|no ha verificado/i);
  });

  it.each(["fr", "en", "es"])("%s : le message d'offre prise est explicite et ne promet aucun remboursement", (langue) => {
    const t: string = messages[langue].detailDemande.offrePrise;
    expect(t.length).toBeGreaterThan(80);
    // La demande n'est pas confirmée ; l'acompte déjà versé est conservé, sans promesse.
    expect(t).toMatch(/pas confirmée|not confirmed|no está confirmada/i);
    expect(t).toMatch(/conserv|kept|conserva/i);
    expect(t).toMatch(/aucun remboursement|no refund|ningún reembolso/i);
  });

  it.each(["fr", "en", "es"])("%s : l'écran d'équipe explique pourquoi aucun acompte ne s'ouvre", (langue) => {
    const a = messages[langue].admin.acompte;
    expect(a.offreDejaConfirmee.length).toBeGreaterThan(40);
    expect(a.offreDejaConfirmeeOuverture.length).toBeGreaterThan(40);
  });

  it.each(["fr", "en", "es"])("%s : l'écran d'équipe dit les limites du remboursement et du trop-perçu", (langue) => {
    const a = messages[langue].admin.acompte;
    expect(a.surplus).toContain("{surplus}");
    expect(a.decisions.limites.length).toBeGreaterThan(40);
    // Aucun délai de remboursement n'est promis au client.
    expect(JSON.stringify(a)).not.toMatch(/sous \d+ jours|within \d+ days|en \d+ días/i);
  });
});
