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
    expect(creee.prix.total).toBe(620000); // 4 nuits * 155000

    // Vérification directe de la ligne en base PostgreSQL
    const enBase = await prisma.demand.findUnique({
      where: { id: creee.id },
    });
    expect(enBase).toBeDefined();
    expect(enBase!.reference).toBe(creee.reference);
    expect(enBase!.prixTotal).toBe(620000);
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

  it("émet le jeton de réponse une fois, en clair, et garde l'empreinte", async () => {
    const demande = await service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-24",
      fin: "2026-11-27",
      personnes: 2,
      visiteurId: "visiteur-jeton",
    });

    // La création ne fabrique plus de jeton : il ne servait à personne.
    expect(await prisma.providerResponseToken.count({ where: { demandeId: demande.id } })).toBe(0);

    const emis = await depot.emettreJetonReponse(demande.id);
    expect(emis?.jeton).toMatch(/^twp_[0-9a-f]{64}$/);
    expect(emis?.prestataire.id).toBeTruthy();

    // En base, l'empreinte seulement — jamais la valeur qui ouvre l'écran.
    const enBase = await prisma.providerResponseToken.findFirst({
      where: { demandeId: demande.id },
    });
    expect(enBase).not.toBeNull();
    expect(enBase!.tokenHash).not.toBe(emis!.jeton);
    expect(new Date(enBase!.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("ne propose à la relance que les demandes en souffrance, et une seule fois", async () => {
    const demande = await service.creerLogement({
      logementId: "l-001",
      debut: "2026-11-28",
      fin: "2026-12-01",
      personnes: 2,
      visiteurId: "visiteur-relance",
    });

    // Seuil dans le futur : la demande est en souffrance quoi qu'il arrive.
    const seuils = { logement: new Date(Date.now() + 60_000) };
    const premier = await depot.aRelancer(seuils, 50);
    expect(premier.map((d) => d.id)).toContain(demande.id);

    await depot.marquerRelancees([demande.id]);

    const second = await depot.aRelancer(seuils, 50);
    expect(second.map((d) => d.id)).not.toContain(demande.id);

    // Un genre absent de la table des seuils n'est jamais relancé.
    const autreGenre = await depot.aRelancer({ taxi: new Date(Date.now() + 60_000) }, 50);
    expect(autreGenre.map((d) => d.id)).not.toContain(demande.id);
  });
});
