import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotDemandesPrisma } from "./demandes.prisma";
import { ServiceDemandes } from "./demandes.service";

describe("Persistance PostgreSQL — Module Demandes & Prévention IDOR", () => {
  let service: ServiceDemandes;
  let prisma: PrismaService;
  let depot: DepotDemandesPrisma;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const depotLogements = new DepotLogementsFixtures();
    const depotVehicules = new DepotVehiculesFixtures();
    depot = new DepotDemandesPrisma(prisma, depotLogements, depotVehicules);
    service = new ServiceDemandes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crée et persiste une demande dans PostgreSQL avec prix figé et coordonnées masquées", async () => {
    const creee = await service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-14",
      personnes: 2,
      visiteurId: "visiteur-test-01",
    });

    expect(creee.id).toMatch(/^d-/);
    expect(creee.reference).toMatch(/^TW-\d{6}$/);
    expect(creee.statut).toBe("envoyee");
    expect(creee.coordonnees).toBeUndefined();
    expect(creee.prix.total).toBe(600000); // 4 nuits * 150000

    // Vérification directe de la ligne en base PostgreSQL
    const enBase = await prisma.demand.findUnique({
      where: { id: creee.id },
    });
    expect(enBase).toBeDefined();
    expect(enBase!.reference).toBe(creee.reference);
    expect(enBase!.prixTotal).toBe(600000);
    expect(enBase!.coordonnees).toBeNull();
  });

  it("révèle et persiste les coordonnées uniquement au statut confirmée", async () => {
    const creee = await service.creerLogement({
      logementId: "l-002",
      debut: "2026-12-01",
      fin: "2026-12-04",
      personnes: 3,
      visiteurId: "visiteur-test-02",
    });

    // Acceptation partenaire
    const acceptee = await service.accepterParPartenaire(creee.id);
    expect(acceptee.statut).toBe("acceptee");
    expect(acceptee.coordonnees).toBeUndefined();

    // Confirmation visiteur
    const confirmee = await service.confirmer(creee.id);
    expect(confirmee.statut).toBe("confirmee");
    expect(confirmee.coordonnees).toBeDefined();

    // Vérification en base PostgreSQL
    const enBase = await prisma.demand.findUnique({
      where: { id: creee.id },
    });
    expect(enBase!.statut).toBe("confirmee");
    expect(enBase!.coordonnees).not.toBeNull();
  });

  it("empêche un visiteur tiers d'accéder ou de modifier la demande d'un autre visiteur (protection IDOR/BOLA)", async () => {
    const visiteurLegitime = "visiteur-legitime";
    const visiteurUsurpateur = "visiteur-usurpateur";

    const demande = await service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-20",
      fin: "2026-11-23",
      personnes: 2,
      visiteurId: visiteurLegitime,
    });

    // Visiteur légitime accède sans problème
    const consultationLegitime = await service.obtenirPourVisiteur(
      demande.id,
      visiteurLegitime,
    );
    expect(consultationLegitime.id).toBe(demande.id);

    // Visiteur tiers tente d'accéder (IDOR en lecture)
    await expect(
      service.obtenirPourVisiteur(demande.id, visiteurUsurpateur),
    ).rejects.toThrow(ErreurMetier);

    // Visiteur tiers tente d'annuler (IDOR en écriture)
    await expect(
      service.annulerPourVisiteur(demande.id, visiteurUsurpateur),
    ).rejects.toThrow(ErreurMetier);
  });
});
