import { describe, expect, it } from "vitest";
import { AEROPORT, jourValide, lieuDeSejour, lienTransfert } from "@teranga/contracts";

/**
 * Où mène chaque accroche du séjour.
 *
 * L'écran de confirmation, la fiche du logement et l'e-mail partent tous de
 * cette règle. Ce qui est verrouillé ici, c'est qu'ils ne puissent pas se
 * contredire : un visiteur arrivé par l'e-mail doit trouver le trajet que
 * l'écran lui avait annoncé.
 */

/** Lit les paramètres d'une adresse relative, comme le fera la page de résultats. */
function lire(adresse: string) {
  const [chemin, requete = ""] = adresse.split("?");
  return { chemin, params: new URLSearchParams(requete) };
}

describe("Séjour — le lieu à nommer", () => {
  it("préfère le quartier quand on le connaît", () => {
    expect(lieuDeSejour({ quartier: "Almadies", ville: "Dakar" })).toBe("Almadies, Dakar");
  });

  it("n'invente jamais un quartier", () => {
    // « Non précisé » n'est pas un lieu : l'écrire enverrait un chauffeur
    // chercher « Non précisé, Dakar ».
    expect(lieuDeSejour({ quartier: "Non précisé", ville: "Dakar" })).toBe("Dakar");
    expect(lieuDeSejour({ quartier: "", ville: "Dakar" })).toBe("Dakar");
  });

  it("ne répète pas la ville", () => {
    expect(lieuDeSejour({ quartier: "Saly", ville: "Saly" })).toBe("Saly");
    expect(lieuDeSejour({ quartier: "saly", ville: "Saly" })).toBe("Saly");
  });
});

describe("Séjour — le transfert à l'arrivée", () => {
  const adresse = lienTransfert({
    sens: "arrivee",
    lieu: "Almadies, Dakar",
    debut: "2026-11-01",
    fin: "2026-11-08",
    personnes: 4,
  });
  const { chemin, params } = lire(adresse);

  it("mène à la recherche de transfert, et reste relatif", () => {
    // Relative : le site y ajoute la langue, l'API y ajoute son domaine.
    expect(chemin).toBe("/transports/resultats");
    expect(adresse.startsWith("/")).toBe(true);
  });

  it("va de l'aéroport au logement, le premier jour", () => {
    expect(params.get("depart")).toBe(AEROPORT);
    expect(params.get("arrivee")).toBe("Almadies, Dakar");
    expect(params.get("quand")).toBe("2026-11-01T10:00");
  });

  it("porte le nombre de voyageurs : il fixe la taille du véhicule", () => {
    expect(params.get("passagers")).toBe("4");
  });
});

describe("Séjour — le transfert au départ", () => {
  const { params } = lire(
    lienTransfert({
      sens: "depart",
      lieu: "Somone",
      debut: "2026-11-01",
      fin: "2026-11-08",
      personnes: 2,
    }),
  );

  it("va du logement à l'aéroport, le dernier jour", () => {
    expect(params.get("depart")).toBe("Somone");
    expect(params.get("arrivee")).toBe(AEROPORT);
    expect(params.get("quand")).toBe("2026-11-08T08:00");
  });
});

describe("Séjour — robustesse de l'adresse", () => {
  it("encode ce qui pourrait casser l'adresse", () => {
    const adresse = lienTransfert({
      sens: "arrivee",
      lieu: "Cité Makiyou Faye, Dakar & co",
      debut: "2026-11-01",
      fin: "2026-11-08",
      personnes: 2,
    });
    // Une esperluette non encodée aurait coupé le lieu en deux paramètres.
    expect(lire(adresse).params.get("arrivee")).toBe("Cité Makiyou Faye, Dakar & co");
  });

  it("ne produit jamais un nombre de voyageurs absurde", () => {
    const lu = (personnes: number) =>
      lire(
        lienTransfert({ sens: "arrivee", lieu: "Dakar", debut: "2026-11-01", fin: "2026-11-02", personnes }),
      ).params.get("passagers");

    expect(lu(0)).toBe("1");
    expect(lu(-3)).toBe("1");
    expect(lu(2.6)).toBe("3");
  });
});

describe("Séjour — les dates venues de l'adresse", () => {
  it("accepte une date qui existe", () => {
    expect(jourValide("2026-11-01")).toBe("2026-11-01");
    expect(jourValide("2028-02-29")).toBe("2028-02-29");
  });

  it("refuse tout le reste", () => {
    // L'écran de confirmation lit ces valeurs dans une adresse que n'importe
    // qui peut écrire : rien de ce qui n'est pas une vraie date ne passe.
    for (const faux of [
      undefined,
      "",
      "demain",
      "2026-13-01",
      "2026-02-30",
      "2027-02-29",
      "2026-11-01T10:00",
      "<script>",
      "2026-11-1",
    ]) {
      expect(jourValide(faux as string | undefined), String(faux)).toBeUndefined();
    }
  });
});
