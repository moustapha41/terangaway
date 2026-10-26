import { lignesSejour } from "@teranga/contracts";
import { describe, expect, it } from "vitest";

import { genererAlerteDemande } from "../../commun/email/modeles/demande-equipe.modele";
import {
  dureeLisible,
  lignesDePrix,
  lignesLogement,
  lignesService,
  lignesTransport,
  momentLisible,
} from "./fiche-reception";

/**
 * Ce que l'équipe lit à la réception d'une demande : la durée choisie, le détail
 * du prix, et pour un transport l'heure de prise en charge — pas seulement un total.
 */

const COMPLET = { prixParNuit: 130_000, prixParSemaine: 650_000, prixParMois: 1_200_000 };

describe("Durée lisible", () => {
  it("nomme la durée proposée au formulaire", () => {
    expect(dureeLisible(3)).toBe("3 nuits · 3 jours");
    expect(dureeLisible(7)).toBe("7 nuits · 1 semaine");
    expect(dureeLisible(14)).toBe("14 nuits · 2 semaines");
    expect(dureeLisible(30)).toBe("30 nuits · 1 mois");
  });

  it("dit « dates choisies à la main » plutôt que d'arrondir", () => {
    expect(dureeLisible(5)).toBe("5 nuits · dates choisies à la main");
    expect(dureeLisible(1)).toBe("1 nuit · dates choisies à la main");
  });
});

describe("Détail du prix", () => {
  const prix = (nuits: number) => ({
    prixParNuit: 130_000,
    nuits,
    fraisFixes: [{ libelle: "Frais de service", montant: 20_000 }],
    total: 0,
    lignes: lignesSejour(COMPLET, nuits),
  });

  it("décompose deux semaines en une ligne, frais compris", () => {
    expect(lignesDePrix(prix(14))).toEqual([
      ["2 semaines", "650 000 FCFA × 2 = 1 300 000 FCFA"],
      ["Frais de service", "20 000 FCFA"],
    ]);
  });

  it("ne recalcule jamais : sans lignes figées, il le dit", () => {
    const ancien = { ...prix(7), lignes: undefined };
    expect(lignesDePrix(ancien)[0]).toEqual(["Hébergement", "7 nuits — détail du tarif non conservé"]);
  });
});

describe("Logement", () => {
  it("donne lieu, dates, durée, places et prix", () => {
    const demande = {
      dates: { debut: "2026-11-01", fin: "2026-11-08" },
      personnes: 3,
      prix: { ...{ prixParNuit: 130_000, nuits: 7, fraisFixes: [], total: 650_000 }, lignes: lignesSejour(COMPLET, 7) },
    } as never;
    const lignes = lignesLogement(demande, { quartier: "Centre", ville: "Somone", capacite: 8 });
    const dict = Object.fromEntries(lignes);
    expect(dict["Lieu"]).toBe("Centre, Somone");
    expect(dict["Arrivée"]).toBe("1 novembre 2026");
    expect(dict["Départ"]).toBe("8 novembre 2026");
    expect(dict["Durée"]).toBe("7 nuits · 1 semaine");
    expect(dict["Voyageurs"]).toBe("3 sur 8 places");
    expect(dict["1 semaine"]).toBe("650 000 FCFA × 1 = 650 000 FCFA");
  });
});

describe("Transport et service", () => {
  it("lit l'heure de prise en charge telle que saisie, sans décalage de fuseau", () => {
    expect(momentLisible("2026-11-02T10:00")).toBe("2 novembre 2026 à 10:00");
    expect(momentLisible("2026-11-02")).toBe("2 novembre 2026");
    expect(momentLisible("n'importe quoi")).toBeUndefined();
  });

  it("dit le trajet, l'heure, les bagages et le vol", () => {
    const dict = Object.fromEntries(
      lignesTransport({
        prestation: "trajet",
        depart: "Aéroport AIBD",
        arrivee: "Almadies",
        quand: "2026-11-02T10:00",
        passagers: 2,
        bagages: 3,
        vol: "AF718",
      }),
    );
    expect(dict["Trajet"]).toBe("Aéroport AIBD → Almadies");
    expect(dict["Prise en charge"]).toBe("2 novembre 2026 à 10:00");
    expect(dict["Bagages"]).toBe("3");
    expect(dict["Numéro de vol"]).toBe("AF718");
  });

  it("n'écrit pas les champs de service vides", () => {
    expect(lignesService({ besoin: "guide", theme: " " })).toEqual([["Besoin", "guide"]]);
  });
});

describe("Alerte équipe", () => {
  const base = {
    reference: "TW-1",
    genre: "logement",
    titre: "Villa",
    contact: { nom: "Fatou" },
    lien: "http://x/admin/demandes/d-1",
  };

  it("affiche le détail à la place du séjour résumé", () => {
    const { texte, html } = genererAlerteDemande({
      ...base,
      sejour: "RESUME",
      detail: [["Durée", "7 nuits · 1 semaine"], ["1 semaine", "650 000 FCFA × 1 = 650 000 FCFA"]],
    });
    expect(texte).toContain("Durée : 7 nuits · 1 semaine");
    expect(html).toContain("650 000 FCFA");
    expect(texte).not.toContain("RESUME");
  });

  it("retombe sur l'ancien séjour sans détail", () => {
    expect(genererAlerteDemande({ ...base, sejour: "1 → 8 nov." }).texte).toContain("Séjour : 1 → 8 nov.");
  });

  it("échappe ce qui vient du visiteur dans le détail", () => {
    const { html } = genererAlerteDemande({ ...base, detail: [["Besoin", "<script>x</script>"]] });
    expect(html).not.toContain("<script>x");
  });
});
