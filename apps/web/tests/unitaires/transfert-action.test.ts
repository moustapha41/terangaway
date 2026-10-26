import { beforeEach, describe, expect, it, vi } from "vitest";
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

const apiChoisirTransfert = vi.fn();
vi.mock("../../src/lib/api/ecriture", () => ({ apiChoisirTransfert: (...a: unknown[]) => apiChoisirTransfert(...a) }));

const apiMockActive = vi.fn(() => false);
vi.mock("../../src/lib/api/http", () => ({ apiMockActive: () => apiMockActive() }));

import { choisirTransfertAction } from "../../src/features/demande/transfert";
import {
  lireRecapitulatif,
  poserRecapitulatif,
  recapitulatifDe,
} from "../../src/features/demande/recapitulatif";

/**
 * La réponse du visiteur à « voulez-vous qu'on vienne vous chercher à
 * l'aéroport ? », côté serveur du site.
 *
 * Trois choses sont verrouillées : le jeton qui autorise la réponse ne vient
 * que du cookie `httpOnly` — sans lui, rien n'est tenté ; l'écran n'apprend
 * « e-mail parti » que si l'API le dit ; et un « oui » renvoyé ne fait pas
 * oublier un e-mail déjà parti.
 */

const JETON = "a".repeat(64);

const DEMANDE = {
  id: "d-9",
  reference: "TW-424242",
  statut: "envoyee",
  offre: { genre: "logement", logementId: "l-009", titre: "Villa", vignette: "" },
  dates: { debut: "2026-11-01", fin: "2026-11-08" },
  personnes: 3,
  prix: { total: 620000 },
  frise: [],
} as unknown as Demande;

async function poser(options: { jeton?: string } = {}) {
  const jeton = "jeton" in options ? options.jeton : JETON;
  await poserRecapitulatif(recapitulatifDe(DEMANDE, true, false, jeton));
}

beforeEach(() => {
  cookieJar.clear();
  apiChoisirTransfert.mockReset();
  apiMockActive.mockReturnValue(false);
});

describe("Récapitulatif — le jeton de suite", () => {
  it("n'est retenu que pour un logement", async () => {
    const vehicule = { ...DEMANDE, offre: { genre: "vehicule", vehiculeId: "v-1", titre: "T", vignette: "" } } as unknown as Demande;
    expect(recapitulatifDe(vehicule, true, false, JETON).jetonSuite).toBeUndefined();
    expect(recapitulatifDe(DEMANDE, true, false, JETON).jetonSuite).toBe(JETON);
  });

  it("ne se relit que s'il a la forme d'un jeton", async () => {
    await poser();
    expect((await lireRecapitulatif())?.jetonSuite).toBe(JETON);

    for (const faux of [123, "", "x".repeat(500), null, {}]) {
      cookieJar.set("teranga_recap", { value: JSON.stringify({ ...recapitulatifDe(DEMANDE, true), jetonSuite: faux }) });
      expect((await lireRecapitulatif())?.jetonSuite, String(faux)).toBeUndefined();
    }
  });

  it("ne relit comme choix que les deux valeurs permises", async () => {
    await poser();
    for (const [valeur, attendu] of [["souhaite", "souhaite"], ["refuse", "refuse"], ["peut-etre", undefined], [true, undefined]] as const) {
      cookieJar.set("teranga_recap", { value: JSON.stringify({ ...recapitulatifDe(DEMANDE, true, false, JETON), transfert: valeur }) });
      expect((await lireRecapitulatif())?.transfert, String(valeur)).toBe(attendu);
    }
  });
});

describe("choisirTransfertAction", () => {
  it("sans jeton — cookie expiré, autre appareil —, ne tente rien", async () => {
    // Pas de cookie du tout.
    expect(await choisirTransfertAction("souhaite")).toEqual({ succes: false, erreur: "indisponible" });

    // Cookie là, mais sans jeton.
    await poser({ jeton: undefined });
    expect(await choisirTransfertAction("souhaite")).toEqual({ succes: false, erreur: "indisponible" });

    expect(apiChoisirTransfert).not.toHaveBeenCalled();
  });

  it("présente à l'API l'identifiant et le jeton du cookie, et rien d'autre", async () => {
    await poser();
    apiChoisirTransfert.mockResolvedValue({ transfert: "souhaite", emailEnvoye: true });

    await choisirTransfertAction("souhaite");
    expect(apiChoisirTransfert).toHaveBeenCalledWith("d-9", { choix: "souhaite", jeton: JETON });
  });

  it("refuse une valeur qui n'est pas l'un des deux choix, sans appeler l'API", async () => {
    await poser();
    expect(await choisirTransfertAction("peut-etre" as never)).toEqual({ succes: false, erreur: "serveur" });
    expect(apiChoisirTransfert).not.toHaveBeenCalled();
  });

  it("« oui », e-mail parti : l'écran peut l'annoncer, et le cookie s'en souvient", async () => {
    await poser();
    apiChoisirTransfert.mockResolvedValue({ transfert: "souhaite", emailEnvoye: true });

    expect(await choisirTransfertAction("souhaite")).toEqual({ succes: true, transfert: "souhaite", emailEnvoye: true });

    const recap = await lireRecapitulatif();
    expect(recap?.transfert).toBe("souhaite");
    expect(recap?.transfertEmailEnvoye).toBe(true);
  });

  it("« oui », e-mail non parti : l'écran ne l'annonce pas", async () => {
    await poser();
    apiChoisirTransfert.mockResolvedValue({ transfert: "souhaite", emailEnvoye: false });

    const res = await choisirTransfertAction("souhaite");
    expect(res).toEqual({ succes: true, transfert: "souhaite", emailEnvoye: false });
    expect((await lireRecapitulatif())?.transfertEmailEnvoye).toBeUndefined();
  });

  it("un « oui » renvoyé ne fait pas oublier l'e-mail déjà parti", async () => {
    await poser();
    apiChoisirTransfert.mockResolvedValueOnce({ transfert: "souhaite", emailEnvoye: true });
    await choisirTransfertAction("souhaite");

    // Le second « oui » n'écrit rien de neuf : l'API répond « pas d'e-mail ».
    apiChoisirTransfert.mockResolvedValueOnce({ transfert: "souhaite", emailEnvoye: false });
    const res = await choisirTransfertAction("souhaite");

    expect(res).toEqual({ succes: true, transfert: "souhaite", emailEnvoye: true });
  });

  it("« non » : enregistré, et aucun e-mail n'est annoncé", async () => {
    await poser();
    apiChoisirTransfert.mockResolvedValue({ transfert: "refuse", emailEnvoye: false });

    expect(await choisirTransfertAction("refuse")).toEqual({ succes: true, transfert: "refuse", emailEnvoye: false });
    expect((await lireRecapitulatif())?.transfert).toBe("refuse");
  });

  it("« non » puis « oui » : redemande vraiment, l'e-mail suit la nouvelle réponse", async () => {
    await poser();
    apiChoisirTransfert.mockResolvedValueOnce({ transfert: "refuse", emailEnvoye: false });
    await choisirTransfertAction("refuse");

    apiChoisirTransfert.mockResolvedValueOnce({ transfert: "souhaite", emailEnvoye: true });
    expect(await choisirTransfertAction("souhaite")).toEqual({ succes: true, transfert: "souhaite", emailEnvoye: true });
  });

  it("une API qui échoue ne fait croire à rien : le choix n'est pas retenu", async () => {
    await poser();
    apiChoisirTransfert.mockRejectedValue(new Error("API injoignable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await choisirTransfertAction("souhaite")).toEqual({ succes: false, erreur: "serveur" });
    expect((await lireRecapitulatif())?.transfert).toBeUndefined();
  });

  it("en démonstration : aucun appel à l'API, et aucun e-mail prétendu", async () => {
    apiMockActive.mockReturnValue(true);
    await poser();

    expect(await choisirTransfertAction("souhaite")).toEqual({ succes: true, transfert: "souhaite", emailEnvoye: false });
    expect(apiChoisirTransfert).not.toHaveBeenCalled();
  });
});
