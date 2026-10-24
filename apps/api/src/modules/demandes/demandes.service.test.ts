import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotDemandesFixtures } from "./demandes.fixtures";
import type { GenreService } from "./machine-a-etats/delais";
import { ServiceDemandes } from "./demandes.service";

describe("ServiceDemandes", () => {
  async function creerService() {
    const module = await Test.createTestingModule({
      providers: [
        ServiceDemandes,
        { provide: DEPOT_DEMANDES, useClass: DepotDemandesFixtures },
      ],
    }).compile();
    return module.get(ServiceDemandes);
  }

  it("parcours nominal : acceptation puis confirmation, sans coordonnées inventées", async () => {
    const service = await creerService();
    const creee = await service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-01",
      fin: "2026-11-05",
      personnes: 2,
      visiteurId: "visiteur-demo",
    });
    expect(creee.statut).toBe("envoyee");
    expect(creee.coordonnees).toBeUndefined();

    const acceptee = await service.accepterParPartenaire(creee.id);
    expect(acceptee.statut).toBe("acceptee");
    expect(acceptee.expireLe).toBeDefined();
    expect(acceptee.coordonnees).toBeUndefined();

    // Les coordonnées sont saisies par l'équipe : la confirmation n'en
    // fabrique aucune, et réussit sans elles.
    const confirmee = await service.confirmer(creee.id);
    expect(confirmee.statut).toBe("confirmee");
    expect(confirmee.coordonnees).toBeUndefined();
    expect(confirmee.expireLe).toBeUndefined();
  });

  it("refus partenaire : motif posé, pas de coordonnées", async () => {
    const service = await creerService();
    const creee = await service.creerLogement({
      logementId: "l-002",
      debut: "2026-12-01",
      fin: "2026-12-08",
      personnes: 2,
      visiteurId: "visiteur-demo",
    });

    const refusee = await service.refuserParPartenaire(creee.id, "dates-impossibles");
    expect(refusee.statut).toBe("refusee");
    expect(refusee.motifRefus).toBe("dates-impossibles");
    expect(refusee.coordonnees).toBeUndefined();
  });

  it("refuse une transition interdite", async () => {
    const service = await creerService();
    const creee = await service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-12",
      personnes: 1,
      visiteurId: "visiteur-demo",
    });

    await expect(service.confirmer(creee.id)).rejects.toBeInstanceOf(ErreurMetier);
  });

  describe("fenêtre de confirmation d'un véhicule accepté", () => {
    const HEURE = 3_600_000;

    /**
     * Une demande de véhicule acceptée. `genreFin` force ce que le dépôt répond ;
     * `"naturel"` laisse le dépôt en mémoire lire le genre qu'il a lui-même
     * enregistré ; `"aucun"` simule un dépôt qui ne sait pas le lire.
     */
    async function accepter(genreFin: GenreService | undefined | "naturel" | "aucun", prestation: "journee" | "trajet" | "taxi" = "journee") {
      class Depot extends DepotDemandesFixtures {}
      if (genreFin === "aucun") (Depot.prototype as { genreDe?: unknown }).genreDe = undefined;
      else if (genreFin !== "naturel") (Depot.prototype as { genreDe?: unknown }).genreDe = async () => genreFin;
      const module = await Test.createTestingModule({
        providers: [ServiceDemandes, { provide: DEPOT_DEMANDES, useClass: Depot }],
      }).compile();
      const service = module.get(ServiceDemandes);
      const demande = await service.creerVehicule({
        vehiculeId: "v-001",
        prestation,
        depart: "Dakar",
        arrivee: "Saly",
        quand: "2026-11-10T09:00",
        passagers: 2,
        bagages: 0,
        visiteurId: "visiteur-demo",
      });
      const acceptee = await service.accepterParPartenaire(demande.id);
      const accepteeLe = Date.parse(acceptee.frise.at(-1)!.horodatage);
      return (Date.parse(acceptee.expireLe!) - accepteeLe) / HEURE;
    }

    it("donne douze heures à une location avec chauffeur", async () => {
      expect(Math.round(await accepter("location"))).toBe(12);
    });

    it.each(["trajet", "taxi", "service"] as const)("garde trois heures pour « %s » : son délai ne change pas", async (genre) => {
      expect(Math.round(await accepter(genre))).toBe(3);
    });

    it("garde trois heures quand le dépôt ne sait pas lire le genre fin (comportement d'avant)", async () => {
      expect(Math.round(await accepter("aucun"))).toBe(3);
      expect(Math.round(await accepter(undefined))).toBe(3);
    });

    it("le dépôt en mémoire lit le genre qu'il a enregistré, comme Prisma : 12 h pour une location, 3 h pour un trajet", async () => {
      expect(Math.round(await accepter("naturel", "journee"))).toBe(12);
      expect(Math.round(await accepter("naturel", "trajet"))).toBe(3);
    });
  });
});
