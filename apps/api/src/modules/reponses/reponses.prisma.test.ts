import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { ErreurMetier } from "../../commun/erreurs";
import { hacherJetonDirect } from "../../commun/securite/hachage";
import { DepotDemandesPrisma } from "../demandes/demandes.prisma";
import { ServiceDemandes } from "../demandes/demandes.service";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotJetonsPrisma } from "./jetons.prisma";
import { ServiceReponses } from "./reponses.service";

describe("Persistance PostgreSQL — Module Réponses Partenaires & Usage Unique", () => {
  let reponses: ServiceReponses;
  let demandes: ServiceDemandes;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const depotJetons = new DepotJetonsPrisma(prisma);
    const depotLogements = new DepotLogementsFixtures();
    const depotVehicules = new DepotVehiculesFixtures();
    const depotDemandes = new DepotDemandesPrisma(prisma, depotLogements, depotVehicules);
    demandes = new ServiceDemandes(depotDemandes);
    reponses = new ServiceReponses(depotJetons, demandes);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ouvre une demande avec un jeton valide, répond et consomme définitivement le jeton (single-use)", async () => {
    // 1. Création d'une demande
    const demande = await demandes.creerLogement({
      logementId: "l-001",
      debut: "2026-11-25",
      fin: "2026-11-28",
      personnes: 2,
      visiteurId: "visiteur-test-reponse",
    });

    // 2. Création d'un jeton partenaire en base
    const rawToken = `jeton-test-secret-${Date.now()}-${Math.random()}`;
    const tokenHash = hacherJetonDirect(rawToken);

    await prisma.providerResponseToken.create({
      data: {
        demandeId: demande.id,
        prestataireId: "prestataire-demo",
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60_000), // 1h
      },
    });

    // 3. Consultation via jeton
    const vue = await reponses.ouvrir(rawToken);
    expect(vue.etat).toBe("valide");
    expect(vue.demande?.reference).toBe(demande.reference);

    // 4. Réponse partenaire : acceptation
    const resultatReponse = await reponses.repondre(rawToken, "acceptee");
    expect(resultatReponse.etat).toBe("repondu");
    expect(resultatReponse.reponse).toBe("acceptee");

    // 5. La demande a basculé au statut acceptée
    const demandeAJour = await demandes.obtenir(demande.id);
    expect(demandeAJour.statut).toBe("acceptee");

    // 6. Tentative de rejouer le jeton : rejet immédiat (single-use)
    await expect(reponses.repondre(rawToken, "acceptee")).rejects.toThrow(
      ErreurMetier,
    );
  });

  it("rejette un jeton partenaire expiré", async () => {
    const rawToken = `jeton-expire-test-${Date.now()}-${Math.random()}`;
    const tokenHash = hacherJetonDirect(rawToken);

    await prisma.providerResponseToken.create({
      data: {
        demandeId: "d-002",
        prestataireId: "prestataire-demo",
        tokenHash,
        expiresAt: new Date(Date.now() - 3600_000), // expiré il y a 1h
      },
    });

    const vue = await reponses.ouvrir(rawToken);
    expect(vue.etat).toBe("expire");

    await expect(reponses.repondre(rawToken, "acceptee")).rejects.toThrow(
      ErreurMetier,
    );
  });
});
