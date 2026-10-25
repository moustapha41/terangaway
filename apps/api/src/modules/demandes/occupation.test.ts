import { describe, expect, it } from "vitest";

import { departEffectif, genreAGarde, jourDe, offreDejaConfirmee, plagesSeChevauchent } from "./occupation";

const sejour = (dateDebut: string | null, dateFin: string | null) => ({ genre: "logement", dateDebut, dateFin });
const location = (dateDebut: string | null) => ({ genre: "location", dateDebut, dateFin: dateDebut });
const seChevauchent = (a: ReturnType<typeof sejour>, b: ReturnType<typeof sejour>) => plagesSeChevauchent("logement", a, b);

describe("Logement — recouvrement de séjours (intervalle semi-ouvert)", () => {
  const A = sejour("2026-11-10", "2026-11-14");

  it.each([
    ["dates identiques", sejour("2026-11-10", "2026-11-14")],
    ["chevauchement partiel, fin dans A", sejour("2026-11-08", "2026-11-11")],
    ["chevauchement partiel, début dans A", sejour("2026-11-13", "2026-11-17")],
    ["inclus dans A", sejour("2026-11-11", "2026-11-12")],
    ["englobe A", sejour("2026-11-01", "2026-11-30")],
    ["une seule nuit commune", sejour("2026-11-13", "2026-11-20")],
  ])("se chevauchent : %s", (_nom, autre) => {
    expect(seChevauchent(A, autre)).toBe(true);
    expect(seChevauchent(autre, A)).toBe(true); // symétrique
  });

  it.each([
    ["adjacent : le départ de A est l'arrivée de B", sejour("2026-11-14", "2026-11-18")],
    ["adjacent : le départ de B est l'arrivée de A", sejour("2026-11-06", "2026-11-10")],
    ["avant, avec un jour d'écart", sejour("2026-11-05", "2026-11-09")],
    ["après, avec un jour d'écart", sejour("2026-11-15", "2026-11-20")],
    ["un autre mois", sejour("2027-03-01", "2027-03-05")],
  ])("cohabitent : %s", (_nom, autre) => {
    expect(seChevauchent(A, autre)).toBe(false);
    expect(seChevauchent(autre, A)).toBe(false);
  });

  it("une demande sans nuit compte une nuit, comme son prix", () => {
    expect(departEffectif("2026-11-10", "2026-11-10")).toBe("2026-11-11");
    expect(departEffectif("2026-11-10", undefined)).toBe("2026-11-11");
    expect(departEffectif("2026-11-10", "2026-11-08")).toBe("2026-11-11");
    expect(seChevauchent(sejour("2026-11-10", "2026-11-10"), sejour("2026-11-10", "2026-11-12"))).toBe(true);
    expect(seChevauchent(sejour("2026-11-10", "2026-11-10"), sejour("2026-11-11", "2026-11-13"))).toBe(false);
  });

  it("lit la partie jour d'une date ISO complète", () => {
    expect(jourDe("2026-11-10T00:00:00.000Z")).toBe("2026-11-10");
    expect(seChevauchent(sejour("2026-11-10T14:00:00Z", "2026-11-14T10:00:00Z"), sejour("2026-11-14", "2026-11-18"))).toBe(false);
    expect(seChevauchent(sejour("2026-11-10T14:00:00Z", "2026-11-14T10:00:00Z"), sejour("2026-11-13", "2026-11-18"))).toBe(true);
  });

  it("franchit les fins de mois et d'année", () => {
    expect(seChevauchent(sejour("2026-12-29", "2027-01-03"), sejour("2027-01-02", "2027-01-05"))).toBe(true);
    expect(seChevauchent(sejour("2026-12-29", "2027-01-03"), sejour("2027-01-03", "2027-01-05"))).toBe(false);
    expect(departEffectif("2026-12-31", "2026-12-31")).toBe("2027-01-01");
    expect(departEffectif("2028-02-28", "2028-02-28")).toBe("2028-02-29"); // année bissextile
  });

  it("ne conclut jamais à un conflit sur une date qu'il ne sait pas lire", () => {
    for (const illisible of [null, "", "demain", "2026-13-40", "2026-02-31", "10/11/2026"]) {
      expect(jourDe(illisible)).toBeUndefined();
      expect(seChevauchent(A, sejour(illisible, "2026-11-12"))).toBe(false);
      expect(seChevauchent(sejour(illisible, null), A)).toBe(false);
    }
  });
});

describe("Location — un véhicule, une réservation par jour calendaire", () => {
  const meme = (a: string, b: string) => plagesSeChevauchent("location", location(a), location(b));

  it("le même jour se chevauche, quelle que soit l'heure", () => {
    expect(meme("2026-11-10T09:00", "2026-11-10T09:00")).toBe(true);
    expect(meme("2026-11-10T09:00", "2026-11-10T17:30")).toBe(true);
    expect(meme("2026-11-10T00:00", "2026-11-10T23:59")).toBe(true);
    expect(meme("2026-11-10T09:00:00.000Z", "2026-11-10T20:00:00.000Z")).toBe(true);
  });

  it("deux jours différents cohabitent, même à une minute d'écart de minuit", () => {
    expect(meme("2026-11-10T09:00", "2026-11-11T09:00")).toBe(false);
    expect(meme("2026-11-10T23:59", "2026-11-11T00:00")).toBe(false);
    expect(meme("2026-11-30T09:00", "2026-12-01T09:00")).toBe(false);
  });

  it("n'utilise que le jour : la fin stockée n'y change rien", () => {
    expect(plagesSeChevauchent("location", { genre: "location", dateDebut: "2026-11-10T09:00", dateFin: "2026-11-12T09:00" }, location("2026-11-11T09:00"))).toBe(false);
  });
});

describe("Périmètre de la garde et refus rendu", () => {
  it("ne concerne que le logement et la location", () => {
    expect(genreAGarde("logement")).toBe(true);
    expect(genreAGarde("location")).toBe(true);
    for (const autre of ["trajet", "taxi", "service", "vehicule", ""]) expect(genreAGarde(autre)).toBe(false);
  });

  it("le refus est un 409 explicite qui ne nomme pas l'autre réservation", () => {
    const erreur = offreDejaConfirmee();
    expect(erreur.getStatus()).toBe(409);
    expect(erreur.getResponse()).toMatchObject({ code: "OFFRE_DEJA_CONFIRMEE" });
    expect(erreur.message).not.toMatch(/TW-\d+|@|d-\d{5,}/);
  });
});
