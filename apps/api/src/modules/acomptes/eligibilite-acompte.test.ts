import { GENRES_DEMANDE } from "@teranga/contracts";
import { describe, expect, it } from "vitest";

import { DELAIS_ACOMPTE_HEURES, delaiAcompteHeures, genreEligibleAcompte } from "./calcul";

/**
 * Quels genres de demande peuvent recevoir un acompte.
 *
 * L'éligibilité est une décision de produit, pas un détail technique : un genre
 * n'y entre que si son total est fiable à l'acceptation et si son cycle de
 * demande laisse le temps de payer. Ce test fige la décision et force à la
 * reprendre explicitement le jour où un genre apparaît ou change de cycle.
 */
describe("Acompte — genres éligibles", () => {
  it("n'accepte que le logement et la location avec chauffeur", () => {
    const eligibles = GENRES_DEMANDE.filter((genre) => genreEligibleAcompte(genre));
    expect(eligibles).toEqual(["logement", "location"]);
  });

  it.each(["trajet", "taxi", "service"] as const)("exclut « %s » : %s", (genre) => {
    expect(genreEligibleAcompte(genre)).toBe(false);
    expect(delaiAcompteHeures(genre)).toBeUndefined();
  });

  it("couvre exactement les genres de demande : un nouveau genre doit être tranché", () => {
    expect(Object.keys(DELAIS_ACOMPTE_HEURES).sort()).toEqual([...GENRES_DEMANDE].sort());
  });

  it("donne un délai positif à chaque genre éligible", () => {
    for (const genre of GENRES_DEMANDE.filter(genreEligibleAcompte)) {
      expect(delaiAcompteHeures(genre)!).toBeGreaterThan(0);
    }
  });
});
