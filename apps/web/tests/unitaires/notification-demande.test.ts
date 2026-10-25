import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

import {
  apiCreerDemandeLogement,
  apiCreerDemandeService,
  apiCreerDemandeVehicule,
} from "../../src/lib/api/ecriture";

const demande = { id: "d-1", reference: "TW-1", statut: "envoyee" };
const repondre = (corps: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(corps), { status: 201 }));

const appels = {
  logement: () => apiCreerDemandeLogement({ logementId: "l", debut: "a", fin: "b", personnes: 1 }),
  vehicule: () =>
    apiCreerDemandeVehicule({ vehiculeId: "v", prestation: "taxi", depart: "x", quand: "q", passagers: 1, bagages: 0 }),
  service: () => apiCreerDemandeService({ service: "guide" as never, details: {} }),
};

describe.each(Object.entries(appels))("Demande %s — ce que l'écran peut affirmer", (_nom, appeler) => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_MOCK = "false";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("relaie l'e-mail réellement parti et l'acompte réellement annoncé", async () => {
    vi.stubGlobal("fetch", repondre({ donnees: demande, notification: { emailEnvoye: true, acompteAnnonce: true } }));
    expect(await appeler()).toMatchObject({ emailEnvoye: true, acompteAnnonce: true });
  });

  it("déclare un e-mail non parti quand l'API le dit", async () => {
    vi.stubGlobal("fetch", repondre({ donnees: demande, notification: { emailEnvoye: false, acompteAnnonce: false } }));
    expect(await appeler()).toMatchObject({ emailEnvoye: false, acompteAnnonce: false });
  });

  it("ne prétend rien quand la notification est absente ou ambiguë", async () => {
    vi.stubGlobal("fetch", repondre({ donnees: demande }));
    expect(await appeler()).toMatchObject({ emailEnvoye: false, acompteAnnonce: false });
    vi.stubGlobal("fetch", repondre({ donnees: demande, notification: { emailEnvoye: "oui", acompteAnnonce: 1 } }));
    expect(await appeler()).toMatchObject({ emailEnvoye: false, acompteAnnonce: false });
  });
});
