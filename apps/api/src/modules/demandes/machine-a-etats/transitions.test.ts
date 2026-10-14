import { describe, expect, it } from "vitest";

import {
  destinationsDepuis,
  transitionPermise,
} from "./transitions";

describe("table de transitions", () => {
  it("autorise le partenaire à accepter ou refuser une demande envoyée", () => {
    expect(transitionPermise("envoyee", "acceptee", "partenaire")).toBe(true);
    expect(transitionPermise("envoyee", "refusee", "partenaire")).toBe(true);
  });

  it("interdit au visiteur d'accepter une demande", () => {
    expect(transitionPermise("envoyee", "acceptee", "visiteur")).toBe(false);
  });

  it("autorise le visiteur à confirmer uniquement depuis acceptée", () => {
    expect(transitionPermise("acceptee", "confirmee", "visiteur")).toBe(true);
    expect(transitionPermise("envoyee", "confirmee", "visiteur")).toBe(false);
    expect(transitionPermise("confirmee", "confirmee", "visiteur")).toBe(false);
  });

  it("bloque toute sortie d'un statut terminal", () => {
    for (const terminal of ["terminee", "refusee", "expiree", "annulee"] as const) {
      expect(transitionPermise(terminal, "annulee", "visiteur")).toBe(false);
      expect(transitionPermise(terminal, "acceptee", "partenaire")).toBe(false);
    }
  });

  it("liste les destinations possibles pour un acteur", () => {
    expect(destinationsDepuis("envoyee", "visiteur")).toEqual(["annulee"]);
    expect(destinationsDepuis("acceptee", "visiteur").sort()).toEqual([
      "annulee",
      "confirmee",
    ]);
  });
});
