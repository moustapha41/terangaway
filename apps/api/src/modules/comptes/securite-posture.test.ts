import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { chargerConfiguration } from "../../config/configuration";
import { avecPosture, enProduction } from "../../commun/securite/posture.test-utils";
import { DepotComptesPrisma } from "./comptes.prisma";
import { ServiceComptes } from "./comptes.service";

/**
 * Posture de sécurité de l'API.
 *
 * L'audit de production a montré que les accès de démonstration étaient restés
 * ouverts sur le site public : `visiteur-demo` était accepté comme session, une
 * requête sans en-tête recevait une identité, et le code OTP revenait dans la
 * réponse HTTP. Tous étaient gardés par `NODE_ENV === "production"` — une seule
 * variable, qui ne valait pas ce qu'on croyait dans le conteneur.
 *
 * D'où la règle que ces tests verrouillent : **une variable d'environnement
 * absente ferme la porte**. Le verrou se lit sur `autoriserComptesDemo`, qui
 * exige une demande explicite *et* un environnement non-production.
 */
describe("Posture de sécurité — le verrou est à refus par défaut", () => {
  it("refuse les comptes de démonstration quand rien n'est demandé", () => {
    const config = chargerConfiguration({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(config.autoriserComptesDemo).toBe(false);
  });

  it("refuse les comptes de démonstration en production, même réclamés", () => {
    const config = chargerConfiguration({
      NODE_ENV: "production",
      AUTORISER_COMPTES_DEMO: "true",
      RESEND_API_KEY: "re_test",
      OTP_SECRET: "secret-de-test-suffisamment-long-pour-passer",
    } as NodeJS.ProcessEnv);

    expect(config.autoriserComptesDemo).toBe(false);
    // Et le signale, pour que la contradiction se voie dans les journaux.
    expect(config.demoRefuseeEnProduction).toBe(true);
  });

  it("n'ouvre les comptes de démonstration que sur demande explicite hors production", () => {
    const ouvert = chargerConfiguration({
      NODE_ENV: "development",
      AUTORISER_COMPTES_DEMO: "true",
    } as NodeJS.ProcessEnv);
    expect(ouvert.autoriserComptesDemo).toBe(true);
    expect(ouvert.demoRefuseeEnProduction).toBe(false);
  });

  it("ne se laisse pas ouvrir par une valeur approximative", () => {
    // Seul `true` compte : ni `1`, ni `yes`, ni une chaîne vide.
    for (const valeur of ["1", "yes", "oui", "", "TRUE ", "false"]) {
      const config = chargerConfiguration({
        NODE_ENV: "development",
        AUTORISER_COMPTES_DEMO: valeur,
      } as NodeJS.ProcessEnv);
      const attendu = valeur.trim().toLowerCase() === "true";
      expect(config.autoriserComptesDemo, `« ${valeur} »`).toBe(attendu);
    }
  });

  it("l'environnement seul ne suffit plus à ouvrir quoi que ce soit", () => {
    // Le cas exact observé en production : NODE_ENV n'était pas `production`,
    // et cela avait suffi à tout ouvrir. Désormais, non.
    const config = chargerConfiguration({ NODE_ENV: "staging" } as NodeJS.ProcessEnv);
    expect(config.estProduction).toBe(false);
    expect(config.autoriserComptesDemo).toBe(false);
  });
});

describe("Posture de sécurité — aucune identité sans jeton de session", () => {
  let service: ServiceComptes;
  let prisma: PrismaService;
  let depot: DepotComptesPrisma;

  const genererTel = () => `77${Math.floor(1000000 + Math.random() * 9000000)}`;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotComptesPrisma(prisma);
    service = new ServiceComptes(depot);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refuse une requête sans aucun en-tête d'identité", async () => {
    await enProduction(async () => {
      await expect(service.exigerVisiteur()).rejects.toThrow(ErreurMetier);
    });
  });

  it("refuse tout accès même si NODE_ENV n'est pas `production`", async () => {
    // Le scénario exactement constaté : le conteneur n'annonçait pas la
    // production, et cela suffisait à distribuer une identité. Le verrou ne
    // dépend plus de cette variable.
    for (const environnement of ["development", "staging", "", "prod"]) {
      await avecPosture({ comptesDemo: false, environnement }, async () => {
        await expect(service.exigerVisiteur(), environnement).rejects.toThrow(ErreurMetier);
        await expect(service.exigerVisiteur("visiteur-demo"), environnement).rejects.toThrow(
          ErreurMetier,
        );
        await expect(
          service.exigerVisiteur(undefined, "123456"),
          environnement,
        ).rejects.toThrow(ErreurMetier);
      });
    }
  });

  it("refuse `visiteur-demo`, quelle que soit la casse ou les espaces", async () => {
    await enProduction(async () => {
      for (const forge of ["visiteur-demo", "Visiteur-Demo", "VISITEUR-DEMO", "  visiteur-demo  "]) {
        await expect(service.exigerVisiteur(forge), forge).rejects.toThrow(ErreurMetier);
        await expect(depot.sessionVisiteur(forge), forge).resolves.toBeNull();
      }
    });
  });

  it("refuse un code OTP présenté directement à une route métier", async () => {
    // Un code se vérifie contre un challenge stocké, par `/comptes/otp/verifier`.
    // Il n'ouvre pas de session sur `POST /demandes/logement`.
    await enProduction(async () => {
      await expect(service.exigerVisiteur(undefined, "123456")).rejects.toThrow(ErreurMetier);
      await expect(service.exigerVisiteur(undefined, "000000")).rejects.toThrow(ErreurMetier);
    });
  });

  it("refuse un identifiant de compte réel présenté comme jeton", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { visiteurId } = await service.verifierOtp(telephone, codeDemo!);

    // `visiteurId` désigne un compte qui existe vraiment. Il circule dans les
    // URL et les journaux : ce n'est pas un secret, et il ne doit rien ouvrir.
    await enProduction(async () => {
      await expect(service.exigerVisiteur(visiteurId)).rejects.toThrow(ErreurMetier);
      await expect(depot.sessionVisiteur(visiteurId)).resolves.toBeNull();
    });
  });

  it("refuse également un identifiant de session présenté comme jeton", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { visiteurId } = await service.verifierOtp(telephone, codeDemo!);

    const session = await prisma.session.findFirst({
      where: { accountId: visiteurId },
      orderBy: { creeLe: "desc" },
    });
    expect(session).not.toBeNull();

    await enProduction(async () => {
      await expect(service.exigerVisiteur(session!.id)).rejects.toThrow(ErreurMetier);
      await expect(depot.sessionVisiteur(session!.id)).resolves.toBeNull();
    });
  });

  it("accepte le jeton réellement émis, et lui seul", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { token, visiteurId } = await service.verifierOtp(telephone, codeDemo!);

    await enProduction(async () => {
      // Le jeton émis ouvre la session.
      await expect(service.exigerVisiteur(token)).resolves.toBe(visiteurId);
      // Y compris préfixé `Bearer`, comme l'envoie le site.
      await expect(service.exigerVisiteur(`Bearer ${token}`)).resolves.toBe(visiteurId);
      // Un jeton voisin, non émis, ne vaut rien.
      await expect(service.exigerVisiteur(`${token}x`)).rejects.toThrow(ErreurMetier);
    });
  });

  it("refuse le jeton après déconnexion, même en mode démo ouvert", async () => {
    const telephone = genererTel();
    const { codeDemo } = await service.envoyerOtp(telephone);
    const { token } = await service.verifierOtp(telephone, codeDemo!);

    await service.deconnecter(token);

    // La révocation ne dépend pas de la posture : une session révoquée est
    // révoquée, mode démo ou pas.
    await avecPosture({ comptesDemo: true, environnement: "development" }, async () => {
      await expect(service.exigerVisiteur(token)).rejects.toThrow(ErreurMetier);
    });
  });
});

describe("Posture de sécurité — le code OTP ne fuite pas", () => {
  let service: ServiceComptes;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    service = new ServiceComptes(new DepotComptesPrisma(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ne renvoie jamais le code dans la réponse hors mode démo", async () => {
    // Renvoyer `codeDemo` sur un déploiement public donne la main sur
    // n'importe quel compte : on demande un code pour une adresse, et on le lit
    // dans la réponse. Le refus ne doit pas dépendre du seul NODE_ENV.
    for (const environnement of ["production", "development", "staging"]) {
      await avecPosture({ comptesDemo: false, environnement }, async () => {
        const reponse = await service.envoyerOtp(
          `posture.fuite.${Date.now()}.${Math.random().toString(36).slice(2)}@terangaway.sn`,
        );
        expect(reponse.codeDemo, environnement).toBeUndefined();
      });
    }
  });

  it("ne stocke jamais le code en clair, quelle que soit la posture", async () => {
    const destination = `posture.hash.${Date.now()}@terangaway.sn`;
    const { codeDemo } = await service.envoyerOtp(destination);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { destination, consumedAt: null },
      orderBy: { creeLe: "desc" },
    });

    expect(challenge).not.toBeNull();
    expect(challenge!.codeHash).toHaveLength(64);
    if (codeDemo) expect(challenge!.codeHash).not.toBe(codeDemo);
  });
});
