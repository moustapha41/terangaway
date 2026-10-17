import { describe, expect, it } from "vitest";

import { lireFiltres } from "./administration.filtres";

describe("lireFiltres", () => {
  it("laisse tout vide sans paramètres", () => {
    expect(lireFiltres({})).toEqual({});
  });

  it("retient les valeurs connues et ignore les inconnues", () => {
    expect(
      lireFiltres({
        statut: "envoyee",
        genre: "taxi",
        service: "guides",
        recherche: "  Awa  ",
        du: "2026-10-01",
        au: "2026-10-17",
        page: "2",
        parPage: "50",
        invente: "non",
      }),
    ).toEqual({
      statut: "envoyee",
      genre: "taxi",
      service: "guides",
      recherche: "Awa",
      du: "2026-10-01",
      au: "2026-10-17",
      page: 2,
      parPage: 50,
    });
  });

  it("jette statut, genre et service hors catalogue", () => {
    expect(
      lireFiltres({
        statut: "brouillon",
        genre: "bateau",
        service: "inconnu",
      }),
    ).toEqual({});
  });

  it("borne la recherche et refuse les dates hors format AAAA-MM-JJ", () => {
    const longue = "x".repeat(200);
    expect(
      lireFiltres({
        recherche: longue,
        du: "01/10/2026",
        au: "2026/10/17",
        page: "0",
        parPage: "-3",
      }),
    ).toEqual({
      recherche: "x".repeat(120),
    });
  });
});
