import { readFileSync } from "node:fs";
import path from "node:path";

import type { StatutDemande } from "@teranga/contracts";
import { describe, expect, it } from "vitest";

import { lienTelephone, vueCoordonnees } from "@/features/demande/coordonnees-affichage";

/**
 * Ce que l'écran d'une demande montre à la place des coordonnées.
 *
 * Deux défauts sont tenus ici : une demande confirmée sans coordonnées lisait
 * « elles apparaissent après votre confirmation », et une demande de véhicule
 * confirmée plantait sur `coordonnees.telephone`, qu'elle n'a pas.
 *
 * Valeurs de test seulement : aucune coordonnée vraisemblable.
 */
const LOGEMENT = {
  adresseExacte: "ADRESSE-DE-TEST",
  telephone: "+000 00 00 00",
  consignesArrivee: "CONSIGNES-DE-TEST",
};
const VEHICULE = {
  immatriculation: "IMMATRICULATION-DE-TEST",
  telephoneChauffeur: "+000 11 11 11",
  lieuDeRendezVous: "RENDEZ-VOUS-DE-TEST",
};

describe("vueCoordonnees", () => {
  it("confirmée sans coordonnées : en préparation, pas « après confirmation »", () => {
    expect(vueCoordonnees({ statut: "confirmee", coordonnees: undefined })).toEqual({ type: "en_preparation" });
    expect(vueCoordonnees({ statut: "terminee", coordonnees: undefined })).toEqual({ type: "en_preparation" });
  });

  it("confirmée, logement : adresse, téléphone composable, consignes", () => {
    expect(vueCoordonnees({ statut: "confirmee", coordonnees: LOGEMENT })).toEqual({
      type: "logement",
      adresse: "ADRESSE-DE-TEST",
      telephone: "+000 00 00 00",
      lienTelephone: "tel:+000000000",
      consignes: "CONSIGNES-DE-TEST",
    });
  });

  it("confirmée, véhicule : lit `telephoneChauffeur`, sans planter", () => {
    expect(vueCoordonnees({ statut: "confirmee", coordonnees: VEHICULE })).toEqual({
      type: "vehicule",
      immatriculation: "IMMATRICULATION-DE-TEST",
      telephone: "+000 11 11 11",
      lienTelephone: "tel:+000111111",
      lieuDeRendezVous: "RENDEZ-VOUS-DE-TEST",
    });
  });

  it("coordonnées d'une forme illisible : rien de partiel, en préparation", () => {
    const bancales = { adresseExacte: "ADRESSE-DE-TEST" } as never;
    expect(vueCoordonnees({ statut: "confirmee", coordonnees: bancales })).toEqual({ type: "en_preparation" });
  });

  it("avant confirmation : elles viendront après", () => {
    for (const statut of ["envoyee", "acceptee"] as StatutDemande[]) {
      expect(vueCoordonnees({ statut, coordonnees: undefined })).toEqual({ type: "apres_confirmation" });
    }
  });

  it("demande morte : rien à montrer, rien à promettre — même si une valeur traîne", () => {
    for (const statut of ["annulee", "expiree", "refusee"] as StatutDemande[]) {
      expect(vueCoordonnees({ statut, coordonnees: LOGEMENT })).toEqual({ type: "aucune" });
    }
  });

  it("compose un lien téléphonique sans espaces", () => {
    expect(lienTelephone("+221 00 000 00 00")).toBe("tel:+221000000000");
  });
});

describe("Pages de demande — pas de transtypage des coordonnées", () => {
  const racine = path.resolve(__dirname, "../../src/app/(langue)/[locale]/(visiteur)");
  const pages = ["mes-demandes/[id]/page.tsx", "compte/reservations/[id]/page.tsx"];

  it("passent par `vueCoordonnees` au lieu de forcer `CoordonneesLogement`", () => {
    for (const page of pages) {
      const source = readFileSync(path.join(racine, page), "utf8");
      expect(source, page).toContain("vueCoordonnees(");
      expect(source, page).not.toMatch(/as CoordonneesLogement/);
      expect(source, page).not.toMatch(/coordonnees\.telephone/);
    }
  });
});

describe("Textes — trois langues", () => {
  const catalogue = (langue: string) =>
    JSON.parse(readFileSync(path.resolve(__dirname, `../../src/messages/${langue}.json`), "utf8"));

  it("portent les nouvelles clés, et le texte d'attente ne promet rien après confirmation", () => {
    for (const langue of ["fr", "en", "es"]) {
      const detail = catalogue(langue).detailDemande;
      for (const cle of ["coordonneesEnPreparation", "priseEnCharge", "immatriculation", "telephoneChauffeur", "rendezVous"]) {
        expect(detail[cle], `${langue}.${cle}`).toBeTruthy();
      }
    }
    expect(catalogue("fr").detailDemande.coordonneesEnPreparation).not.toMatch(/après votre confirmation/);
  });
});
