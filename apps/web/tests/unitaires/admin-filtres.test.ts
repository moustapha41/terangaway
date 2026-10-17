import { describe, expect, it } from "vitest";

import { parametresFiltres } from "@/lib/api/administration";

describe("parametresFiltres", () => {
  it("omet les valeurs vides et sérialise le reste", () => {
    expect(
      parametresFiltres({
        statut: "envoyee",
        genre: undefined,
        service: "guides",
        recherche: "",
        du: "2026-10-01",
        page: 2,
      }),
    ).toBe("statut=envoyee&service=guides&du=2026-10-01&page=2");
  });

  it("rend une chaîne vide sans filtre", () => {
    expect(parametresFiltres({})).toBe("");
  });
});
