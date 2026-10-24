import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../base-de-donnees/prisma.service";
import { creerPrismaDeTest } from "../../base-de-donnees/base-de-test.test-utils";
import { ErreurMetier } from "../../commun/erreurs";
import { hacherJetonDirect } from "../../commun/securite/hachage";
import { enProduction } from "../../commun/securite/posture.test-utils";
import { DepotLogementsFixtures } from "../offres/logements/logements.fixtures";
import { DepotVehiculesFixtures } from "../offres/vehicules/vehicules.fixtures";
import { DepotDemandesPrisma } from "../demandes/demandes.prisma";
import { ServiceDemandes } from "../demandes/demandes.service";
import { DepotComptesPrisma } from "./comptes.prisma";
import { ServiceComptes } from "./comptes.service";

/**
 * Le lien d'accès à une demande, sur PostgreSQL (base `teranga_test` seule).
 *
 * Trois choses que les fixtures en mémoire ne peuvent pas prouver : l'usage
 * unique tient sous concurrence, le lien ne se mêle pas aux codes de connexion,
 * et il ne mène qu'à la demande de son destinataire.
 */
describe("Lien d'accès à une demande — PostgreSQL", () => {
  let prisma: PrismaService;
  let comptes: ServiceComptes;
  let depot: DepotComptesPrisma;
  let demandes: ServiceDemandes;

  const adresse = (etiquette: string) =>
    `lien.${etiquette}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@terangaway.sn`;
  const code = (e: unknown) => ((e as ErreurMetier).getResponse() as { code: string }).code;

  beforeAll(async () => {
    prisma = creerPrismaDeTest();
    await prisma.$connect();
    depot = new DepotComptesPrisma(prisma);
    comptes = new ServiceComptes(depot);
    demandes = new ServiceDemandes(
      new DepotDemandesPrisma(prisma, new DepotLogementsFixtures(), new DepotVehiculesFixtures()),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function demandeDe(email: string) {
    const visiteur = await comptes.visiteurPourDemande(undefined, { email });
    const demande = await demandes.creerLogement({
      logementId: "l-001",
      debut: "2026-11-10",
      fin: "2026-11-14",
      personnes: 2,
      visiteurId: visiteur.compteId,
    });
    const lien = await comptes.emettreLienDemande({
      compteId: visiteur.compteId,
      email,
      demandeId: demande.id,
    });
    return { visiteur, demande, lien };
  }

  it("ne stocke que l'empreinte du jeton, jamais le jeton", async () => {
    const { lien, demande } = await demandeDe(adresse("empreinte"));
    const lignes = await prisma.otpChallenge.findMany({ where: { finalite: `lien_demande:${demande.id}` } });
    expect(lignes).toHaveLength(1);
    expect(lignes[0].codeHash).toBe(hacherJetonDirect(lien.jeton));
    expect(JSON.stringify(lignes[0])).not.toContain(lien.jeton);
  });

  it("deux requêtes simultanées ne consomment jamais le même jeton", async () => {
    await enProduction(async () => {
      const { lien } = await demandeDe(adresse("concurrence"));
      // 25 présentations simultanées du même jeton, depuis des IP distinctes
      // pour ne pas être arrêtées par le limiteur : seule la base arbitre.
      const issues = await Promise.allSettled(
        Array.from({ length: 25 }, (_, i) => comptes.ouvrirParLienDemande(lien.jeton, `10.0.0.${i}`)),
      );
      const reussies = issues.filter((i) => i.status === "fulfilled");
      const refus = issues.filter((i) => i.status === "rejected") as PromiseRejectedResult[];

      expect(reussies).toHaveLength(1);
      expect(refus).toHaveLength(24);
      expect(new Set(refus.map((r) => code(r.reason)))).toEqual(new Set(["LIEN_DEJA_UTILISE"]));
    });
  });

  it("expire en base : un lien dont l'échéance est passée est refusé", async () => {
    await enProduction(async () => {
      const { lien, demande } = await demandeDe(adresse("expire"));
      await prisma.otpChallenge.updateMany({
        where: { finalite: `lien_demande:${demande.id}` },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(comptes.ouvrirParLienDemande(lien.jeton, "10.1.0.1")).rejects.toSatisfy(
        (e) => code(e) === "LIEN_EXPIRE",
      );
    });
  });

  it("un code de connexion demandé après coup n'invalide pas le lien", async () => {
    await enProduction(async () => {
      const email = adresse("otp-apres");
      const { lien } = await demandeDe(email);
      await comptes.envoyerOtp(email, "10.2.0.1");
      await expect(comptes.ouvrirParLienDemande(lien.jeton, "10.2.0.2")).resolves.toBeTruthy();
    });
  });

  it("le lien ne retarde pas la demande d'un code (ni cooldown, ni quota)", async () => {
    const email = adresse("cooldown");
    await demandeDe(email); // émet un lien à l'instant
    const verdict = await depot.verifierRateLimit(email, "10.3.0.1");
    expect(verdict.autorise).toBe(true);
  });

  it("le lien ne sert pas de code de connexion, ni l'inverse", async () => {
    await enProduction(async () => {
      const email = adresse("croise");
      const { lien } = await demandeDe(email);

      // Le jeton du lien présenté comme code OTP : refusé.
      await expect(comptes.verifierOtp(email, lien.jeton)).rejects.toBeInstanceOf(ErreurMetier);

      // Un vrai code OTP présenté comme jeton de lien : refusé, et sans effet sur le lien.
      const envoi = await comptes.envoyerOtp(email, "10.4.0.1");
      const otp = envoi.codeDemo ?? "000000";
      await expect(comptes.ouvrirParLienDemande(otp, "10.4.0.2")).rejects.toBeInstanceOf(ErreurMetier);
      await expect(comptes.ouvrirParLienDemande(lien.jeton, "10.4.0.3")).resolves.toBeTruthy();
    });
  });

  it("le lien de l'un n'ouvre que la demande de l'un, et la session obtenue ne lit pas celle de l'autre", async () => {
    await enProduction(async () => {
      const a = await demandeDe(adresse("a"));
      const b = await demandeDe(adresse("b"));

      const ouverture = await comptes.ouvrirParLienDemande(a.lien.jeton, "10.5.0.1");
      expect(ouverture.demandeId).toBe(a.demande.id);

      const visiteurId = await comptes.exigerVisiteur(ouverture.token);
      // Sa propre demande : lisible.
      await expect(demandes.obtenirPourVisiteur(a.demande.id, visiteurId)).resolves.toMatchObject({
        id: a.demande.id,
      });
      // Celle d'un autre visiteur : refusée côté serveur.
      await expect(demandes.obtenirPourVisiteur(b.demande.id, visiteurId)).rejects.toBeInstanceOf(
        ErreurMetier,
      );
    });
  });

  it("refuse un jeton qui n'existe pas en base", async () => {
    await enProduction(async () => {
      await expect(
        comptes.ouvrirParLienDemande("twl_" + "c".repeat(64), "10.6.0.1"),
      ).rejects.toSatisfy((e) => code(e) === "LIEN_INVALIDE");
    });
  });
});
