import { describe, expect, it } from "vitest";
import type { DemandeAdmin } from "@teranga/contracts";

import { composerCsv } from "./administration.service";

function demande(partiel: Partial<DemandeAdmin> & Pick<DemandeAdmin, "reference">): DemandeAdmin {
  const {
    id = "d-1",
    reference,
    statut = "envoyee",
    genre = "logement",
    creeLe = "2026-10-17T10:00:00.000Z",
    misAJourLe = "2026-10-17T10:00:00.000Z",
    offre = {
      genre: "logement",
      logementId: "l-1",
      titre: "Villa Almadies",
      vignette: "/media/logement.jpg",
    },
    dates = { debut: "2026-11-01", fin: "2026-11-05" },
    personnes = 2,
    prix = { total: 150000 },
    frise = [
      { statut: "envoyee", horodatage: "2026-10-17T10:00:00.000Z", origine: "visiteur" },
    ],
    visiteur = {
      id: "v-1",
      nom: "Awa Diop",
      email: "awa@exemple.sn",
      telephone: "770000000",
    },
    ...reste
  } = partiel;

  return {
    id,
    reference,
    statut,
    genre,
    creeLe,
    misAJourLe,
    offre,
    dates,
    personnes,
    prix,
    frise,
    visiteur,
    ...reste,
  };
}

describe("composerCsv", () => {
  it("ouvre avec le BOM UTF-8 et des colonnes séparées par des points-virgules", () => {
    const csv = composerCsv([]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("reference;statut;genre;");
    expect(csv).toContain("note_interne");
  });

  it("écrit une ligne par demande, avec les détails de service collés", () => {
    const csv = composerCsv([
      demande({
        reference: "TW-1",
        genre: "service",
        offre: {
          genre: "service",
          service: "guides",
          titre: "Guide",
          details: { quartier: "Plateau", duree: "demi-journee" },
        },
        service: {
          cle: "guides",
          details: { quartier: "Plateau", duree: "demi-journee" },
        },
        message: "Bonjour",
        prixPropose: 25000,
        prestataire: { id: "p-1", nom: "Moussa Ndiaye" },
        noteInterne: "Rappeler demain",
      }),
    ]);

    expect(csv).toContain('"TW-1"');
    expect(csv).toContain('"guides"');
    expect(csv).toContain('"quartier=Plateau | duree=demi-journee"');
    expect(csv).toContain('"Moussa Ndiaye"');
    expect(csv).toContain('"25000"');
    expect(csv).toContain('"Rappeler demain"');
  });

  it("neutralise une formule Excel et échappe les guillemets", () => {
    const csv = composerCsv([
      demande({
        reference: "TW-2",
        message: '=HYPERLINK("http://x")',
        noteInterne: 'dit "urgent"',
        visiteur: {
          id: "v-2",
          nom: "+33 6",
          email: "@menace",
          telephone: "-1",
        },
      }),
    ]);

    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"dit ""urgent"""`);
    expect(csv).toContain(`"'+33 6"`);
    expect(csv).toContain(`"'@menace"`);
    expect(csv).toContain(`"'-1"`);
  });
});
