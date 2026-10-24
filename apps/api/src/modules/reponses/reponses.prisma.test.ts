import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { hacherJetonDirect } from "../../commun/securite/hachage";
import { DepotDemandesPrisma } from "../demandes/demandes.prisma";
import { ServiceDemandes } from "../demandes/demandes.service";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotJetonsPrisma } from "./jetons.prisma";
import { ServiceReponses } from "./reponses.service";
import { fenetreUnique, reserverFenetres } from "../demandes/fenetres-uniques.test-utils";

describe("Persistance PostgreSQL — Module Réponses Partenaires & Usage Unique", () => {
  let reponses: ServiceReponses;
  let demandes: ServiceDemandes;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    await reserverFenetres(prisma);
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

  /** Un suffixe par ligne créée : deux exécutions ne se heurtent pas. */
  const suffixe = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Le partenaire à qui le jeton donne le pouvoir de répondre.
   *
   * Créé ici, et c'est le point : ces tests s'appuyaient sur un compte
   * `prestataire-demo` et une demande `d-002` qu'ils ne créaient pas. Ils
   * passaient parce que la base de développement les contenait — déposés par
   * d'autres tests ou par un ancien seed. Sur une base propre, les deux clés
   * étrangères tombaient. Un test ne doit rien devoir à ce qui s'est exécuté
   * avant lui.
   */
  const prestataire = () =>
    prisma.account.create({
      data: {
        nom: "Prestataire de test",
        email: `prestataire.reponse.${suffixe()}@test.local`,
        role: "PRESTATAIRE",
        typeCompte: "LES_DEUX",
        estVerifie: true,
        verifieLe: new Date(),
      },
    });

  /** Une demande de logement neuve, au statut « envoyée ». */
  const logement = () =>
    demandes.creerLogement({
      logementId: "l-001",
      ...fenetreUnique(3),
      personnes: 2,
      visiteurId: `visiteur-reponse-${suffixe()}`,
    });

  it("ouvre une demande avec un jeton valide, répond et consomme définitivement le jeton (single-use)", async () => {
    // 1. Une demande, et le partenaire qui va y répondre
    const demande = await logement();
    const hote = await prestataire();

    // 2. Création d'un jeton partenaire en base
    const rawToken = `jeton-test-secret-${suffixe()}`;
    const tokenHash = hacherJetonDirect(rawToken);

    await prisma.providerResponseToken.create({
      data: {
        demandeId: demande.id,
        prestataireId: hote.id,
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
    const demande = await logement();
    const hote = await prestataire();

    const rawToken = `jeton-expire-test-${suffixe()}`;
    const tokenHash = hacherJetonDirect(rawToken);

    await prisma.providerResponseToken.create({
      data: {
        demandeId: demande.id,
        prestataireId: hote.id,
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
