import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotDemandesPrisma } from "./demandes.prisma";
import { ServiceDemandes } from "./demandes.service";
import { fenetreUnique, reserverFenetres } from "./fenetres-uniques.test-utils";

describe("Persistance PostgreSQL — Module Demandes & Prévention IDOR", () => {
  let service: ServiceDemandes;
  let prisma: PrismaService;
  let depot: DepotDemandesPrisma;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    await reserverFenetres(prisma);
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
      ...fenetreUnique(4),
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

  it("ne révèle jamais des coordonnées non vérifiées, même confirmée", async () => {
    const creee = await service.creerLogement({
      logementId: "l-002",
      ...fenetreUnique(3),
      personnes: 3,
      visiteurId: "visiteur-test-02",
    });

    // Acceptation partenaire
    const acceptee = await service.accepterParPartenaire(creee.id);
    expect(acceptee.statut).toBe("acceptee");
    expect(acceptee.coordonnees).toBeUndefined();

    // Coordonnées saisies par l'équipe : gardées en base, jamais rendues au
    // visiteur tant qu'une seconde personne ne les a pas vérifiées — ce que
    // la base ne sait pas encore enregistrer (migration en attente).
    const saisies = { adresseExacte: "ADRESSE-DE-TEST", telephone: "TELEPHONE-DE-TEST" };
    await prisma.demand.update({ where: { id: creee.id }, data: { coordonnees: saisies } });
    expect((await service.obtenir(creee.id)).coordonnees).toBeUndefined();

    // Confirmation visiteur : rien n'est fabriqué, rien de non vérifié ne sort
    const confirmee = await service.confirmer(creee.id);
    expect(confirmee.statut).toBe("confirmee");
    expect(confirmee.coordonnees).toBeUndefined();

    // Vérification en base PostgreSQL : la saisie est intacte
    const enBase = await prisma.demand.findUnique({
      where: { id: creee.id },
    });
    expect(enBase!.statut).toBe("confirmee");
    expect(enBase!.coordonnees).toEqual(saisies);
  });

  it("empêche un visiteur tiers d'accéder ou de modifier la demande d'un autre visiteur (protection IDOR/BOLA)", async () => {
    const visiteurLegitime = "visiteur-legitime";
    const visiteurUsurpateur = "visiteur-usurpateur";

    const demande = await service.creerLogement({
      logementId: "l-001",
      ...fenetreUnique(3),
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
      ...fenetreUnique(3),
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
      ...fenetreUnique(3),
      personnes: 2,
      visiteurId: "visiteur-relance",
    });

    // Seuil dans le futur : la demande est en souffrance quoi qu'il arrive.
    const seuils = { logement: new Date(Date.now() + 60_000) };

    /**
     * La page à demander pour être sûr d'y voir sa propre demande.
     *
     * `aRelancer` rend une page ordonnée par date de création **croissante**,
     * et la demande qu'on vient de créer est la plus récente : elle est donc
     * la dernière. Une limite fixe — 50 — la laissait hors de la page dès que
     * la base comptait plus de candidates que cela, et le test échouait sans
     * que rien n'ait changé dans le code. On dimensionne donc la page sur les
     * données présentes, en comptant les candidates avec la même condition que
     * le dépôt : statut « envoyée », jamais relancée, du genre visé, créée
     * avant le seuil.
     */
    const candidates = () =>
      prisma.demand.count({
        where: {
          statut: "envoyee",
          relanceeLe: null,
          genre: "logement",
          creeLe: { lte: seuils.logement },
        },
      });

    const premier = await depot.aRelancer(seuils, await candidates());
    expect(premier.map((d) => d.id)).toContain(demande.id);

    await depot.marquerRelancees([demande.id]);

    // Une de moins : c'est la marque qui l'a retirée, pas un effet de page.
    const second = await depot.aRelancer(seuils, (await candidates()) + 1);
    expect(second.map((d) => d.id)).not.toContain(demande.id);

    // Un genre absent de la table des seuils n'est jamais relancé.
    const autreGenre = await depot.aRelancer({ taxi: new Date(Date.now() + 60_000) }, 50);
    expect(autreGenre.map((d) => d.id)).not.toContain(demande.id);
  });

  describe("choix du transfert depuis l'aéroport", () => {
    const creer = (visiteurId: string) =>
      service.creerLogement({
        logementId: "l-001",
        debut: "2026-12-01",
        fin: "2026-12-08",
        personnes: 2,
        visiteurId,
      });

    it("rend l'ancien choix, pose le nouveau, et ne réécrit pas un choix identique", async () => {
      const demande = await creer("visiteur-transfert-a");

      const premier = await depot.enregistrerTransfert(demande.id, "souhaite");
      expect(premier?.avant).toBeUndefined();
      expect(premier?.demande.transfert).toBe("souhaite");

      const ecrit = await prisma.demand.findUnique({ where: { id: demande.id } });
      expect(ecrit?.transfertAeroport).toBe("souhaite");
      expect(ecrit?.transfertChoisiLe).toBeInstanceOf(Date);

      // Le même choix renvoyé : rien de neuf, et la date reste celle de la première réponse.
      const second = await depot.enregistrerTransfert(demande.id, "souhaite");
      expect(second?.avant).toBe("souhaite");
      const relu = await prisma.demand.findUnique({ where: { id: demande.id } });
      expect(relu?.transfertChoisiLe?.getTime()).toBe(ecrit?.transfertChoisiLe?.getTime());

      // Un vrai changement : l'ancien choix est rendu.
      const change = await depot.enregistrerTransfert(demande.id, "refuse");
      expect(change?.avant).toBe("souhaite");
      expect(change?.demande.transfert).toBe("refuse");
    });

    it("attend la réponse qui est en train de s'écrire, et la voit", async () => {
      // La course que le verrou ferme, rendue déterministe. Deux clics rapprochés
      // lisent « pas de choix » en même temps, écrivent chacun, et se croient
      // chacun le premier : deux e-mails au visiteur, deux alertes à l'équipe.
      //
      // Un test qui lance trois appels à la fois ne l'attrape pas — ils vont trop
      // vite, et il passe aussi sans verrou. Ici, une transaction tient la ligne ;
      // un appel démarre et doit **attendre** ; la première écrit « oui » et
      // relâche. L'appel en attente doit alors voir ce « oui ». Sans verrou, il
      // aurait lu « rien » dès son départ.
      const demande = await creer("visiteur-transfert-b");

      let relacher!: () => void;
      const barriere = new Promise<void>((resolu) => (relacher = resolu));
      let verrouPris!: () => void;
      const pris = new Promise<void>((resolu) => (verrouPris = resolu));

      const titulaire = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "demands" WHERE "id" = ${demande.id} FOR UPDATE`;
        verrouPris();
        await barriere;
        await tx.demand.update({
          where: { id: demande.id },
          data: { transfertAeroport: "souhaite", transfertChoisiLe: new Date() },
        });
      });

      await pris;
      const enAttente = depot.enregistrerTransfert(demande.id, "souhaite");

      // Laisse à l'appel le temps d'atteindre le verrou, puis relâche.
      await new Promise((r) => setTimeout(r, 250));
      relacher();
      await titulaire;

      const resultat = await enAttente;
      expect(resultat?.avant).toBe("souhaite");
    });

    it("rend le contact du visiteur, pour lui écrire", async () => {
      const demande = await creer("visiteur-transfert-c");
      const resultat = await depot.enregistrerTransfert(demande.id, "souhaite");
      expect(resultat?.contact).toBeDefined();
    });

    it("ignore une demande qui n'existe pas, et la base refuse tout autre choix", async () => {
      expect(await depot.enregistrerTransfert("d-inconnue", "souhaite")).toBeNull();

      const demande = await creer("visiteur-transfert-d");
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "demands" SET "transfertAeroport" = 'peut-etre' WHERE "id" = $1`,
          demande.id,
        ),
      ).rejects.toThrow();
    });
  });
});
