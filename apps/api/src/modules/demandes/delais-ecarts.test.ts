import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { DepotDemandesFixtures } from "./demandes.fixtures";
import { ServiceDemandes } from "./demandes.service";
import { DELAIS, type GenreService } from "./machine-a-etats/delais";

/**
 * Ce que le code applique, face à ce que `DELAIS` déclare.
 *
 * Ce test ne **choisit** aucune règle : il décrit l'état réel, et exige que
 * tout écart soit nommé. Un écart non listé fait échouer le test ; un écart
 * listé qui disparaît le fait échouer aussi, pour que la liste ne mente pas.
 * Corriger l'un d'eux est une décision de produit (voir « Écarts connus » dans
 * `machine-a-etats/delais.ts`) : on modifie alors ce test, en connaissance de cause.
 */
const MINUTE = 60_000;

async function monter() {
  const module = await Test.createTestingModule({
    providers: [ServiceDemandes, { provide: DEPOT_DEMANDES, useClass: DepotDemandesFixtures }],
  }).compile();
  return module.get(ServiceDemandes);
}

/** Crée une demande du genre voulu, la fait accepter, et mesure les deux fenêtres. */
async function mesurer(genre: GenreService) {
  const service = await monter();
  const visiteurId = "visiteur-demo";
  const vehicule = (prestation: "trajet" | "journee" | "taxi") =>
    service.creerVehicule({
      vehiculeId: "v-001", prestation, depart: "Dakar", arrivee: "Saly",
      quand: "2026-11-10T09:00", passagers: 2, bagages: 0, visiteurId,
    });
  const creee =
    genre === "logement"
      ? await service.creerLogement({ logementId: "l-001", debut: "2026-11-10", fin: "2026-11-14", personnes: 2, visiteurId })
      : genre === "service"
        ? await service.creerService({ service: "guides", details: { zone: "Dakar" }, visiteurId })
        : await vehicule(genre === "location" ? "journee" : genre);

  const creationLe = Date.parse(creee.frise[0].horodatage);
  const reponse = creee.expireLe ? Math.round((Date.parse(creee.expireLe) - creationLe) / MINUTE) : null;

  const acceptee = await service.accepterParPartenaire(creee.id);
  const accepteeLe = Date.parse(acceptee.frise.at(-1)!.horodatage);
  const confirmation = Math.round((Date.parse(acceptee.expireLe!) - accepteeLe) / MINUTE);
  return { reponse, confirmation };
}

/** Écarts de **confirmation visiteur**, nommés : minutes appliquées. */
const ECARTS_CONFIRMATION: Partial<Record<GenreService, number>> = {
  taxi: 3 * 60, //    déclaré 15 min (PRD §10) — le visiteur n'est pas prévenu à l'acceptation
  service: 3 * 60, // déclaré 12 h (absent du PRD)
};

/** Écarts d'**expiration de la réponse**, nommés : minutes appliquées (`null` = jamais). */
const ECARTS_REPONSE: Partial<Record<GenreService, number | null>> = {
  service: null, // déclaré 6 h : une demande de service est créée sans échéance
};

describe("Délais — ce qui est appliqué face à DELAIS", () => {
  const genres = Object.keys(DELAIS) as GenreService[];

  it.each(genres)("%s : fenêtre de confirmation du visiteur", async (genre) => {
    const { confirmation } = await mesurer(genre);
    const attendu = ECARTS_CONFIRMATION[genre] ?? DELAIS[genre].confirmationVisiteurMinutes;
    expect(confirmation).toBe(attendu);
    if (genre in ECARTS_CONFIRMATION) {
      // Un écart listé doit en être un : sinon la liste est périmée.
      expect(confirmation).not.toBe(DELAIS[genre].confirmationVisiteurMinutes);
    }
  });

  it.each(genres)("%s : expiration de la réponse du partenaire", async (genre) => {
    const { reponse } = await mesurer(genre);
    const attendu = genre in ECARTS_REPONSE ? ECARTS_REPONSE[genre] : DELAIS[genre].expirationReponseMinutes;
    expect(reponse).toBe(attendu);
    if (genre in ECARTS_REPONSE) expect(reponse).not.toBe(DELAIS[genre].expirationReponseMinutes);
  });

  it("la location et le logement se confirment en douze heures, comme le PRD", () => {
    expect(DELAIS.location.confirmationVisiteurMinutes).toBe(12 * 60);
    expect(DELAIS.logement.confirmationVisiteurMinutes).toBe(12 * 60);
  });

  it("le taxi : la règle écrite est de 15 minutes, et elle n'est pas appliquée", () => {
    // Le jour où ce test change, il doit changer avec la décision de prévenir le
    // visiteur à l'acceptation — sans quoi les demandes de taxi expirent inaperçues.
    expect(DELAIS.taxi.confirmationVisiteurMinutes).toBe(15);
    expect(ECARTS_CONFIRMATION.taxi).toBe(180);
  });
});
