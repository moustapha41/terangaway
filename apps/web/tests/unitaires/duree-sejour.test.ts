import { describe, expect, it } from "vitest";
import {
  DUREES_SEJOUR,
  NUITS_PAR_MOIS,
  ajouterJours,
  nuitsEntre,
  prixSemaine,
  sousTotalSejour,
  totalSejour,
} from "@teranga/contracts";
import { LOGEMENTS } from "../../src/mocks/fixtures/logements";

/**
 * Le prix d'un séjour selon sa durée : trois jours, une semaine, deux, trois,
 * un mois.
 *
 * Ce que ces tests tiennent, c'est que le prix annoncé à l'écran et celui que
 * l'API enregistre soient le même — c'est la même fonction — et surtout les
 * **frontières**, là où un prix se trompe : 29 nuits contre 30, avec et sans
 * tarif mensuel.
 */

// Une annonce qui n'annonce que sa nuitée.
const NUITEE = { prixParNuit: 40_000 };
// Une semaine moins chère que sept nuitées, et pas de tarif mensuel.
const SEMAINE = { prixParNuit: 130_000, prixParSemaine: 650_000 };
// Les trois tarifs annoncés.
const COMPLET = { prixParNuit: 130_000, prixParSemaine: 650_000, prixParMois: 1_200_000 };

describe("Durées proposées", () => {
  it("sont exactement cinq, du plus court au plus long", () => {
    expect(DUREES_SEJOUR.map((d) => d.nuits)).toEqual([3, 7, 14, 21, 30]);
    expect(DUREES_SEJOUR.map((d) => d.cle)).toEqual([
      "troisJours",
      "uneSemaine",
      "deuxSemaines",
      "troisSemaines",
      "unMois",
    ]);
  });

  it("finissent sur un mois qui vaut le mois de la règle de prix", () => {
    // Si l'un des deux bougeait, « 1 mois » n'afficherait plus le tarif mensuel.
    expect(DUREES_SEJOUR.at(-1)!.nuits).toBe(NUITS_PAR_MOIS);
  });
});

describe("Prix d'un séjour — annonce sans tarif de semaine ni de mois", () => {
  it("multiplie la nuitée, à toutes les durées", () => {
    for (const { nuits } of DUREES_SEJOUR) {
      expect(sousTotalSejour(NUITEE, nuits), `${nuits} nuits`).toBe(nuits * 40_000);
    }
  });
});

describe("Prix d'un séjour — tarif de semaine annoncé", () => {
  it("trois jours se comptent à la nuitée, une semaine au tarif de la semaine", () => {
    expect(sousTotalSejour(SEMAINE, 3)).toBe(3 * 130_000);
    expect(sousTotalSejour(SEMAINE, 7)).toBe(650_000);
  });

  it("deux et trois semaines sont des semaines entières", () => {
    expect(sousTotalSejour(SEMAINE, 14)).toBe(2 * 650_000);
    expect(sousTotalSejour(SEMAINE, 21)).toBe(3 * 650_000);
  });

  it("un mois sans tarif mensuel se compte en semaines, jamais en rabais inventé", () => {
    // Quatre semaines et deux nuits : c'est ce que le propriétaire a annoncé,
    // et rien d'autre. Lui prêter un tarif mensuel serait lui promettre un prix.
    expect(sousTotalSejour(SEMAINE, 30)).toBe(4 * 650_000 + 2 * 130_000);
  });
});

describe("Prix d'un séjour — tarif mensuel annoncé", () => {
  it("un mois entier se compte au tarif mensuel", () => {
    expect(sousTotalSejour(COMPLET, 30)).toBe(1_200_000);
  });

  it("la frontière : 29 nuits ne sont pas un mois", () => {
    // Quatre semaines et une nuit : le tarif mensuel ne s'applique qu'au mois entier.
    expect(sousTotalSejour(COMPLET, 29)).toBe(4 * 650_000 + 130_000);
    expect(sousTotalSejour(COMPLET, 30)).toBe(1_200_000);
  });

  it("au-delà d'un mois, le reste retombe sur les semaines puis les nuits", () => {
    // 45 nuits : un mois, deux semaines, une nuit.
    expect(sousTotalSejour(COMPLET, 45)).toBe(1_200_000 + 2 * 650_000 + 130_000);
    // 60 nuits : deux mois.
    expect(sousTotalSejour(COMPLET, 60)).toBe(2 * 1_200_000);
  });

  it("les durées plus courtes ne changent pas", () => {
    expect(sousTotalSejour(COMPLET, 3)).toBe(sousTotalSejour(SEMAINE, 3));
    expect(sousTotalSejour(COMPLET, 21)).toBe(sousTotalSejour(SEMAINE, 21));
  });
});

describe("Prix d'un séjour — frais fixes", () => {
  it("s'ajoutent une fois, quelle que soit la durée", () => {
    const frais = [{ montant: 25_000 }, { montant: 10_000 }];
    expect(totalSejour(COMPLET, 7, frais)).toBe(650_000 + 35_000);
    expect(totalSejour(COMPLET, 30, frais)).toBe(1_200_000 + 35_000);
  });
});

describe("Prix d'un séjour — le catalogue réel", () => {
  it("trois nuits se comptent à la nuitée, pour toutes les annonces", () => {
    // Moins d'une semaine : aucun tarif de semaine ou de mois n'intervient.
    for (const l of LOGEMENTS) {
      expect(sousTotalSejour(l, 3), l.id).toBe(3 * l.prixParNuit);
    }
  });

  it("une semaine vaut exactement le prix affiché à la semaine", () => {
    // Ce que l'écran annonce « par semaine » est ce que « 1 semaine » facture.
    for (const l of LOGEMENTS) {
      expect(sousTotalSejour(l, 7), l.id).toBe(prixSemaine(l));
    }
  });

  it("un mois vaut le tarif mensuel quand l'annonce en a un", () => {
    for (const l of LOGEMENTS.filter((x) => x.prixParMois !== undefined)) {
      expect(sousTotalSejour(l, 30), l.id).toBe(l.prixParMois);
    }
  });
});

describe("Jours et nuits", () => {
  it("ajoute des jours, d'un mois ou d'une année à l'autre", () => {
    expect(ajouterJours("2026-11-01", 7)).toBe("2026-11-08");
    expect(ajouterJours("2026-11-25", 10)).toBe("2026-12-05");
    expect(ajouterJours("2026-12-28", 7)).toBe("2027-01-04");
    expect(ajouterJours("2028-02-27", 3)).toBe("2028-03-01"); // 2028 est bissextile
  });

  it("traverse le changement d'heure sans perdre un jour", () => {
    // Les séjours de sept nuits ne tombent ni sur six ni sur huit.
    expect(ajouterJours("2026-03-25", 7)).toBe("2026-04-01");
    expect(ajouterJours("2026-10-25", 7)).toBe("2026-11-01");
  });

  it("compte les nuits entre deux jours, jamais moins d'une", () => {
    expect(nuitsEntre("2026-11-01", "2026-11-08")).toBe(7);
    expect(nuitsEntre("2026-11-01", "2026-12-01")).toBe(30);
    expect(nuitsEntre("2026-11-01", "2026-11-01")).toBe(1);
    expect(nuitsEntre("2026-11-08", "2026-11-01")).toBe(1);
  });

  it("ajouter puis compter se répondent", () => {
    for (const { nuits } of DUREES_SEJOUR) {
      expect(nuitsEntre("2026-11-01", ajouterJours("2026-11-01", nuits))).toBe(nuits);
    }
  });
});
