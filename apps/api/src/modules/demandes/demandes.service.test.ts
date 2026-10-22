import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotDemandesFixtures } from "./demandes.fixtures";
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
});
