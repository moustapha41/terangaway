import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VueAcompteAdmin } from "@teranga/contracts";

const jar = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (n: string) => jar.get(n), set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { COOKIE_ADMIN } from "../../src/features/admin/cookie";
import {
  analyserSaisie,
  cleErreurAcompte,
  cleEtatEnvoi,
  formaterFrancs,
  saisiePrete,
} from "../../src/features/admin/acompte-admin";
import {
  preparerAcompteAction,
  renvoyerConfirmationAction,
  renvoyerInstructionsAction,
  saisirReceptionAction,
} from "../../src/features/admin/actions";

const vue = (resteDu: number): VueAcompteAdmin =>
  ({ actif: true, statutDemande: "acceptee", resteDu, journal: [], acteurs: {}, actions: {} }) as unknown as VueAcompteAdmin;

describe("Acompte (équipe) — analyse de la saisie", () => {
  it("compare le montant saisi au reste dû calculé par le serveur", () => {
    expect(analyserSaisie(vue(186000), "186000")).toEqual({ sens: "exact", ecart: 0, exigeConfirmation: false });
    expect(analyserSaisie(vue(186000), "100 000")).toEqual({ sens: "inferieur", ecart: -86000, exigeConfirmation: true });
    expect(analyserSaisie(vue(186000), "200000")).toEqual({ sens: "superieur", ecart: 14000, exigeConfirmation: true });
  });

  it.each(["", "abc", "0", "-5", "10,5", "1e3"])("ne juge pas une saisie invalide : « %s »", (texte) => {
    expect(analyserSaisie(vue(186000), texte).sens).toBeNull();
  });

  it("n'autorise l'envoi qu'après vérification humaine, et reconnaissance de tout écart", () => {
    const exact = analyserSaisie(vue(100), "100");
    const ecart = analyserSaisie(vue(100), "50");
    const champs = { verifie: true, ecartConfirme: false, commentaire: "" };

    expect(saisiePrete(exact, champs)).toBe(true);
    expect(saisiePrete(exact, { ...champs, verifie: false })).toBe(false); // jamais sans vérification
    expect(saisiePrete(ecart, champs)).toBe(false);
    expect(saisiePrete(ecart, { ...champs, ecartConfirme: true })).toBe(false); // commentaire requis
    expect(saisiePrete(ecart, { verifie: true, ecartConfirme: true, commentaire: "  " })).toBe(false);
    expect(saisiePrete(ecart, { verifie: true, ecartConfirme: true, commentaire: "partiel" })).toBe(true);
    expect(saisiePrete({ sens: null, ecart: 0, exigeConfirmation: false }, { ...champs })).toBe(false);
  });

  it("formate en FCFA, sans espace insécable", () => {
    expect(formaterFrancs(186000, "fr")).toBe("186 000 FCFA");
    expect(formaterFrancs(186000, "en")).toBe("186,000 FCFA");
  });
});

describe("Acompte (équipe) — textes", () => {
  const messages = Object.fromEntries(
    ["fr", "en", "es"].map((l) => [l, JSON.parse(readFileSync(join(__dirname, `../../src/messages/${l}.json`), "utf8"))]),
  );
  const lire = (langue: string, cle: string) =>
    cle.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages[langue]);

  it("chaque code d'erreur et chaque état d'envoi a son texte dans les trois langues", () => {
    const codes = [
      "ACOMPTE_ECART_A_CONFIRMER", "ACOMPTE_CUMUL_CONCURRENT", "ACOMPTE_STATUT_CONCURRENT", "ACOMPTE_RECEPTION_DOUBLON",
      "ACOMPTE_NON_ATTENDU", "ACOMPTE_DEMANDE_CLOSE", "ACOMPTE_RIEN_A_CONFIRMER", "NON_AUTHENTIFIE", "INTERDIT",
      "REQUETE_INVALIDE", "INJOIGNABLE", "CODE_INCONNU",
    ];
    const cles = [
      ...codes.map(cleErreurAcompte),
      ...["envoye", "envoyees", "echec", "sans_destinataire", "non_requis", "deja_envoyees"].map(cleEtatEnvoi),
    ].filter((c): c is string => !!c);
    for (const langue of ["fr", "en", "es"]) {
      for (const cle of cles) expect(typeof lire(langue, cle), `${langue} ${cle}`).toBe("string");
    }
  });

  it("les statuts d'acompte, les moyens et les types d'événement sont tous traduits", () => {
    const cles = [
      ...["en_attente", "partiel", "paye", "expire", "annule", "a_rembourser", "rembourse"].map((s) => `admin.acompte.statut.${s}`),
      ...["virement", "wave", "orange-money"].map((m) => `admin.acompte.moyen.${m}`),
      ...["preparation", "instructions_envoyees", "rappel_envoye", "preuve_declaree", "verification", "reception_confirmee",
        "doublon_signale", "anomalie_signalee", "expiration_prononcee", "annulation", "remboursement_decide",
        "remboursement_effectue", "envoi_echoue"].map((e) => `admin.acompte.evenement.${e}`),
    ];
    for (const langue of ["fr", "en", "es"]) {
      for (const cle of cles) expect(typeof lire(langue, cle), `${langue} ${cle}`).toBe("string");
    }
  });

  it("un échec d'envoi n'est jamais présenté comme un envoi réussi", () => {
    expect(cleEtatEnvoi("echec")).toBe("admin.acompte.envoi.echec");
    expect(cleEtatEnvoi("sans_destinataire")).toBe("admin.acompte.envoi.sansDestinataire");
    expect(cleEtatEnvoi("inconnu")).toBeNull();
  });
});

describe("Acompte (équipe) — actions serveur", () => {
  const apiInitiale = process.env.NEXT_PUBLIC_API_MOCK;
  beforeEach(() => {
    jar.clear();
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = apiInitiale;
    vi.unstubAllGlobals();
  });

  it("refusent sans session, sans appeler l'API", async () => {
    const fetchSimule = vi.fn();
    vi.stubGlobal("fetch", fetchSimule);
    for (const resultat of await Promise.all([
      preparerAcompteAction("d-1"),
      saisirReceptionAction("d-1", { montant: 1, montantRecuAvant: 0 }),
      renvoyerInstructionsAction("d-1"),
      renvoyerConfirmationAction("d-1"),
    ])) {
      expect(resultat).toMatchObject({ succes: false, code: "NON_AUTHENTIFIE" });
    }
    expect(fetchSimule).not.toHaveBeenCalled();
  });

  it("n'envoient à l'API que la lecture de la personne, avec sa session", async () => {
    jar.set(COOKIE_ADMIN, { value: "tws_" + "a".repeat(64) });
    const fetchSimule = vi.fn(async () =>
      new Response(JSON.stringify({ donnees: { resultat: { emailConfirmation: "echec" }, vue: vue(0) } }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchSimule);

    const res = await saisirReceptionAction("d-1", { montant: 186000, montantRecuAvant: 0, referenceTransaction: "TX" });

    expect(res).toMatchObject({ succes: true, info: "echec" });
    const [url, init] = fetchSimule.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/administration/demandes/d-1/acompte/reception");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer tws_${"a".repeat(64)}`);
    expect(JSON.parse(String(init.body))).toEqual({ montant: 186000, montantRecuAvant: 0, referenceTransaction: "TX" });
  });

  it("rendent le code de refus de l'API plutôt qu'un succès", async () => {
    jar.set(COOKIE_ADMIN, { value: "tws_" + "a".repeat(64) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ erreur: { code: "ACOMPTE_CUMUL_CONCURRENT", message: "x" } }), { status: 409 })),
    );
    expect(await saisirReceptionAction("d-1", { montant: 5, montantRecuAvant: 0 })).toMatchObject({
      succes: false,
      code: "ACOMPTE_CUMUL_CONCURRENT",
    });
  });

  it("traitent une panne réseau comme un échec", async () => {
    jar.set(COOKIE_ADMIN, { value: "tws_" + "a".repeat(64) });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    expect(await renvoyerConfirmationAction("d-1")).toMatchObject({ succes: false, code: "INJOIGNABLE" });
  });
});

describe("Fichier d'actions de l'équipe", () => {
  it("n'exporte que des fonctions : Next refuse tout autre export au rendu", async () => {
    const module = await import("../../src/features/admin/actions");
    for (const [nom, valeur] of Object.entries(module)) {
      expect(typeof valeur, `export « ${nom} »`).toBe("function");
    }
  });
});
